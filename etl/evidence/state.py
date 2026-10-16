"""State instruments and parties, linked without changing accounting totals."""
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
import logging

import requests
from sqlalchemy import select

from etl.shared.models import EmendaEstadual, StateExpenseDocument
from etl.state.pb import BASE_ORCAMENTO, paginated
from etl.state.documents import normalize_amendment
from etl.evidence.identity import amendment_references, beneficiary_mentions, cge, digits
from etl.evidence.store import cached, evidence, now, replace_source, url

logger = logging.getLogger(__name__)
AGREEMENT_FIELDS = set("ano mes numeroConvenio numeroCadastroCGE nomeConcedente nomeConvenente nomeMunicipio objeto detalheObjeto tipoInstrumento valorTotal documentoConvenio".split())
CONTRACT_FIELDS = set("anoInicioVigencia registroCge numeroContrato numeroProcessoLicitacao nomeOrgao municipio objeto objetoComplemento contratado cnpjCpf dataAssinatura dataInicioVigencia dataTerminoVigencia valorTotal urlContrato".split())
QUEUE_FIELDS = set("ano mes contrato liquidacao numeroEmpenho numeroAp numeroPagamento codigoUnidadeGestora descricaoUnidadeGestora codigoFonteRecursos fonteRecursos codigoStatus status cnpjCpfCredor nomeCredor dataInsercao dataExecucao valorPago".split())


def fetch_rows(endpoint, params, fields):
    try:
        for row in paginated(BASE_ORCAMENTO, endpoint, params):
            yield {k: v for k, v in row.items() if k in fields}
    except requests.HTTPError as error:
        r = error.response
        # Accept only a JSON no-data response on the first page. Other errors
        # propagate and preserve the previous database snapshot.
        if r is None or r.status_code != 404:
            raise
        from urllib.parse import parse_qs, urlparse
        body = r.json()
        message = str(body.get("message") or body.get("detail") or "").lower()
        page = parse_qs(urlparse(r.url or "").query).get("page", ["1"])[0]
        if page != "1" or not any(s in message for s in ["nenhum", "não encontr", "nao encontr"]):
            raise


def state_context(engine, years):
    with engine.connect() as connection:
        listings = [dict(r) for r in connection.execute(select(EmendaEstadual).where(EmendaEstadual.ano.in_(years))).mappings()]
        notes = [dict(r) for r in connection.execute(select(StateExpenseDocument).where(StateExpenseDocument.year.in_(years))).mappings()]
    known = {(r["ano"], normalize_amendment(r["numero_emenda"], r["ano"])): r for r in listings}
    return known, notes


def instrument_evidence(known, notes, agreements, contracts):
    result = []
    by_cge = defaultdict(set)
    for document in notes:
        if document["kind"] == "commitment":
            code = cge(document["payload"].get("registroCGE"))
            if code:
                by_cge[code].add((document["year"], document["amendment_number"]))
    for row, collected_at, source_url in agreements:
        explicit = amendment_references(row.get("detalheObjeto"))
        key = cge(row.get("numeroCadastroCGE"))
        cge_matches = by_cge.get(key, set())
        matches = explicit if explicit else (cge_matches if len(cge_matches) == 1 else set())
        for year, number in matches:
            if (year, number) not in known:
                continue
            basis = "Referência explícita à emenda e exercício no instrumento" if explicit else "Cadastro CGE exato ligado a uma única emenda nas notas"
            payload = {"numeroInstrumento": row.get("numeroConvenio"), "cadastroCge": row.get("numeroCadastroCGE"),
                       "nome": row.get("nomeConvenente"), "papel": "convenente", "municipio": row.get("nomeMunicipio"),
                       "objeto": row.get("detalheObjeto") or row.get("objeto"), "tipoInstrumento": row.get("tipoInstrumento"),
                       "documentoUrl": row.get("documentoConvenio"), "valorInstrumento": row.get("valorTotal"),
                       "observacao": "O instrumento identifica o convenente; não comprova recebimento financeiro ou entrega física."}
            result.append(evidence("state", year, number, "pb_agreements", "agreement", "confirmed",
                          f"{row.get('tipoInstrumento') or 'Instrumento'} {row.get('numeroConvenio') or ''}",
                          source_url, collected_at, basis, payload))
    seen = set()
    for row, collected_at, source_url in contracts:
        key = cge(row.get("registroCge"))
        if not key:
            continue
        # One contract can fund several amendments. The association does not
        # allocate the whole contract value to any individual amendment.
        for year, number in by_cge.get(key, set()):
            if (year, number) not in known:
                continue
            creditor = digits(row.get("cnpjCpf"))
            compatible = [n for n in notes if n["year"] == year and n["amendment_number"] == number
                          and n["kind"] == "commitment" and cge(n["payload"].get("registroCGE")) == key
                          and digits(n["payload"].get("cpfCnpj")) == creditor]
            if not compatible or len(creditor) != 14:
                continue
            identity = (year, number, row.get("urlContrato") or (key, row.get("numeroContrato"), creditor))
            if identity in seen:
                continue
            seen.add(identity)
            payload = {"numeroContrato": row.get("numeroContrato"), "cadastroCge": row.get("registroCge"),
                       "nome": row.get("contratado"), "cnpj": creditor, "papel": "contratado", "orgao": row.get("nomeOrgao"),
                       "municipio": row.get("municipio"), "processo": row.get("numeroProcessoLicitacao"),
                       "objeto": row.get("objeto"), "documentoUrl": row.get("urlContrato"),
                       "valorInstrumento": row.get("valorTotal"), "data": row.get("dataAssinatura"),
                       "observacao": "Valor global do contrato, não atribuível integralmente à emenda. Contratação não comprova pagamento ou entrega."}
            result.append(evidence("state", year, number, "pb_contracts", "contract", "confirmed",
                          f"Contrato {row.get('numeroContrato') or ''}", source_url, collected_at,
                          "Cadastro CGE normalizado e CNPJ do contratado iguais aos da nota de empenho", payload))
    return result


def load_instruments(engine, years, *, refresh=False):
    known, notes = state_context(engine, years)
    listings_at = now()
    mentions = []
    for (year, number), listing in known.items():
        if number is None:
            continue
        for mention in beneficiary_mentions(listing.get("objeto")):
            mentions.append(evidence("state", year, number, "pb_objects", "beneficiary", "candidate",
                            "Entidade citada no objeto", url(BASE_ORCAMENTO, "orcamento/listagem_emendas", {"ano": year, "emenda": listing["numero_emenda"]}),
                            listings_at, "CNPJ com dígitos verificadores válidos extraído do objeto; papel ainda depende de validação",
                            {**mention, "papel": "entidade_citada", "observacao": "Candidato extraído do texto; não substitui o beneficiário original nem identifica automaticamente seu papel."}))
    for year in years:
        replace_source(engine, "state", year, "pb_objects", [e for e in mentions if e["year"] == year],
                       sum(y == year for y, _ in known), listings_at, "Objetos da listagem carregada; extração local, sem nova consulta à fonte")
    agreements, contracts = [], []
    times = defaultdict(list)
    for year in years:
        for source, endpoint, params, fields, target in [
            ("pb_agreements", "/convenios/estado_municipios", {"ano": year}, AGREEMENT_FIELDS, agreements),
            ("pb_contracts", "/compras/contratos", {"anoInicioVigencia": year}, CONTRACT_FIELDS, contracts),
        ]:
            logger.info("PB evidencias: %s %d", source, year)
            rows, at = cached(f"{source}_{year}", lambda: fetch_rows(endpoint, params, fields), refresh=refresh)
            target.extend((r, at, url(BASE_ORCAMENTO, endpoint, params)) for r in rows)
            times[source].append(at)
    linked = instrument_evidence(known, notes, agreements, contracts)
    for source, raw in [("pb_agreements", agreements), ("pb_contracts", contracts)]:
        for year in years:
            count = replace_source(engine, "state", year, source, [e for e in linked if e["year"] == year and e["source"] == source],
                                   len(raw), max(times[source]), f"Instrumentos iniciados em {','.join(map(str,years))}; vínculo ao exercício da emenda")
            logger.info("PB %d %s: %d evidencias", year, source, count)


def queue_evidence(document, row, source_url, at):
    payment = document["payload"]
    same = lambda a, b: a is not None and b is not None and str(a).strip().lstrip("0") == str(b).strip().lstrip("0")
    ap = row.get("numeroAp") or row.get("numeroPagamento")
    if not same(payment.get("numeroDocumento"), ap) or not same(payment.get("numeroEmpenho"), row.get("numeroEmpenho")):
        return None
    creditor = digits(row.get("cnpjCpfCredor"))
    if len(creditor) != 14 or creditor != digits(payment.get("cnpjCpfCredor")):
        return None
    if not same(payment.get("codigoFonteRecurso"), row.get("codigoFonteRecursos")):
        return None
    return evidence("state", document["year"], document["amendment_number"], "pb_payment_queue", "payment_context", "candidate",
                    f"Ordem cronológica / AP {ap}", source_url, at,
                    "Autorização, empenho, CNPJ e fonte coincidem; exercício do empenho e unidade ainda precisam de confirmação",
                    {"numeroEmpenho": row.get("numeroEmpenho"), "numeroPagamento": ap,
                     "numeroContrato": row.get("contrato"), "statusPagamento": row.get("status"),
                     "codigoUnidade": row.get("codigoUnidadeGestora"), "data": row.get("dataExecucao"),
                     "valorMovimento": row.get("valorPago"), "observacao": "Estar na fila não comprova pagamento. Não altera o RF-08."})


def load_payment_context(engine, years, *, refresh=False):
    _, documents = state_context(engine, years)
    for year in years:
        payments = [d for d in documents if d["year"] == year and d["kind"] == "payment"]
        found, times, count = [], [], 0
        groups = defaultdict(list)
        for payment in payments:
            groups[(payment["month"], str(payment["payload"].get("numeroEmpenho")))].append(payment)
        def collect(entry):
            (month, note), matching_payments = entry
            params = {"ano": year, "mes": month, "numeroEmpenho": note}
            token = sha256(str(params).encode()).hexdigest()[:16]
            endpoint = "/despesas/ordem_cronologica_pagamentos"
            rows, at = cached(f"pb_payment_queue_{year}_{token}", lambda: fetch_rows(endpoint, params, QUEUE_FIELDS), refresh=refresh)
            linked = [item for payment in matching_payments for row in rows
                      if (item := queue_evidence(payment, row, url(BASE_ORCAMENTO, endpoint, params), at))]
            return len(rows), at, linked
        logger.info("PB fila %d: %d consultas distintas / %d pagamentos candidatos", year, len(groups), len(payments))
        # Bounded I/O concurrency; each request owns its retrying session.
        # A failed future aborts the year before database replacement.
        with ThreadPoolExecutor(max_workers=4) as executor:
            for index, (size, at, linked) in enumerate(executor.map(collect, groups.items()), 1):
                count += size
                times.append(at)
                found.extend(linked)
                if index % 25 == 0 or index == len(groups):
                    logger.info("PB fila %d: %d/%d consultas completas", year, index, len(groups))
        linked = replace_source(engine, "state", year, "pb_payment_queue", found, count, max(times) if times else now(),
                                "Consultas pelo mês/ano do pagamento candidato e número do empenho; não cobre todos os meses da fila ou restos a pagar")
        logger.info("PB %d: %d contextos de pagamento", year, linked)
