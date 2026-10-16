"""Public Transferegov execution evidence, without treating declarations as audits."""
import logging
from sqlalchemy import select
from etl.shared.http import create_session
from etl.shared.models import Emenda, TransferegovPlanoAcao
from etl.evidence.identity import digits
from etl.evidence.store import cached, evidence, now, replace_source, url

BASE = "https://api-publica.transferegov.gestao.gov.br/especiais"
SOURCE = "transferegov_specials"
logger = logging.getLogger(__name__)
FIELDS = {
    "planos-acao-especiais": "id_plano_acao ano_emenda_parlamentar_plano_acao numero_emenda_parlamentar_plano_acao codigo_parlamentar_emenda_plano_acao sequencial_emenda_parlamentar_plano_acao id_beneficiario nome_objeto detalhamento_objeto situacao_plano_acao",
    "planos-trabalho-especiais": "id_plano_trabalho id_plano_acao situacao_plano_trabalho data_inicio_execucao_plano_trabalho data_fim_execucao_plano_trabalho",
    "relatorios-gestao-especiais": "id_relatorio_gestao id_plano_acao data_relatorio_gestao tipo_relatorio_gestao situacao_relatorio_gestao valor_executado_relatorio_gestao valor_pendente_relatorio_gestao descritivo_relatorio_gestao",
    "relatorios-gestao-novos-especiais": "id_relatorio_gestao_novo id_plano_acao id_executor data_relatorio_gestao_novo tipo_relatorio_gestao_novo situacao_relatorio_gestao_novo valor_executado_relatorio_gestao_novo valor_pendente_relatorio_gestao_novo",
    "relatorios-gestao-documento-liquidacao-especiais": "id_relatorio_gestao_dl id_relatorio_gestao_novo tx_descricao_relatorio_gestao_dl tp_doc_recebedor_relatorio_gestao_dl tx_identificacao_recebedor_mascarado_relatorio_gestao_dl tx_nome_recebedor_relatorio_gestao_dl vl_pagamento_relatorio_gestao_dl dt_pagamento_relatorio_gestao_dl tx_natureza_relatorio_gestao_dl",
}


def paginated(endpoint, params, session=None):
    session = session or create_session({"User-Agent": "RastreaEmendas/1.0 (TCC IFPB)"})
    page, seen, total = 1, 0, None
    while True:
        response = session.get(f"{BASE}/{endpoint}", params={**params, "pagina": page, "tamanho_da_pagina": 200}, timeout=90)
        response.raise_for_status()
        body = response.json()
        batch = body.get("data") if isinstance(body, dict) else None
        if not isinstance(batch, list) or any(not isinstance(r, dict) for r in batch):
            raise ValueError("Resposta Transferegov invalida")
        if body.get("page_number") != page or not isinstance(body.get("total_items"), int) or not isinstance(body.get("total_pages"), int):
            raise ValueError("Paginacao Transferegov invalida")
        if total is not None and total != body["total_items"]:
            raise ValueError("Total alterado durante a paginacao; repetir a carga")
        total = body["total_items"]
        seen += len(batch)
        for row in batch:
            yield {k: v for k, v in row.items() if k in FIELDS[endpoint].split()}
        if page >= body["total_pages"]:
            if seen != total:
                raise ValueError(f"Coleta incompleta: {seen}/{total}")
            return
        if not batch:
            raise ValueError("Pagina intermediaria vazia")
        page += 1


def plan_code(row):
    year = row.get("ano_emenda_parlamentar_plano_acao")
    number = digits(row.get("numero_emenda_parlamentar_plano_acao"))
    if len(number) == 12 and number.startswith(str(year)):
        return number
    author = digits(row.get("codigo_parlamentar_emenda_plano_acao"))
    sequence = digits(row.get("sequencial_emenda_parlamentar_plano_acao"))
    if year and author and sequence and len(author) <= 4 and len(sequence) <= 4:
        return f"{year}{author.zfill(4)}{sequence.zfill(4)}"
    return None


def load_specials(engine, years, *, refresh=False):
    with engine.connect() as connection:
        known = {r.codigo_emenda: r.ano for r in connection.execute(select(Emenda.codigo_emenda, Emenda.ano).where(Emenda.ano.in_(years)))}
        plans = [dict(r) for r in connection.execute(select(TransferegovPlanoAcao).where(
            TransferegovPlanoAcao.ano_emenda.in_(years), TransferegovPlanoAcao.uf_beneficiario == "PB")).mappings()]
    for year in years:
        found, times, count = [], [], 0
        selected = [p for p in plans if p["ano_emenda"] == year and known.get(str(p["numero_emenda"])) == year]
        def fetch(endpoint, key, value):
            nonlocal count
            rows, at = cached(f"specials_{endpoint}_{key}_{value}", lambda: paginated(endpoint, {key: value}), refresh=refresh)
            if any(str(r.get(key)) != str(value) for r in rows):
                raise ValueError(f"Filtro ignorado na fonte: {endpoint} {key}")
            times.append(at)
            count += len(rows)
            return rows, at, url(BASE, endpoint, {key: value})
        for plan in selected:
            plan_id, number = plan["id_plano_acao"], str(plan["numero_emenda"])
            logger.info("Transferegov: emenda %s plano %s", number, plan_id)
            rows, at, source_url = fetch("planos-acao-especiais", "id_plano_acao", plan_id)
            if len(rows) != 1 or plan_code(rows[0]) != number:
                # Do not silently declare a mismatched/absent plan fully consulted.
                raise ValueError(f"Identidade da emenda nao confirmada no plano {plan_id}")
            row = rows[0]
            found.append(evidence("federal", year, number, SOURCE, "action_plan", "confirmed", f"Plano de ação {plan_id}", source_url, at,
                "ID do plano e código completo da emenda conferidos entre Transferegov e CGU",
                {"idPlanoAcao": plan_id, "objeto": row.get("detalhamento_objeto") or row.get("nome_objeto"), "nome": plan.get("nome_beneficiario"), "papel": "beneficiario_transferencia", "situacao": row.get("situacao_plano_acao"), "observacao": "Beneficiário da transferência não é automaticamente fornecedor ou solicitante original."}))
            for endpoint, kind in [("planos-trabalho-especiais", "work_plan"), ("relatorios-gestao-especiais", "management_report"), ("relatorios-gestao-novos-especiais", "management_report")]:
                rows, at, source_url = fetch(endpoint, "id_plano_acao", plan_id)
                for row in rows:
                    suffix = "_novo" if "novos" in endpoint else ""
                    identifier = row.get("id_plano_trabalho") if kind == "work_plan" else row.get(f"id_relatorio_gestao{suffix}")
                    payload = {"idPlanoAcao": plan_id, "idDocumento": identifier, "situacao": row.get("situacao_plano_trabalho") or row.get(f"situacao_relatorio_gestao{suffix}"),
                        "data": row.get(f"data_relatorio_gestao{suffix}") or row.get("data_inicio_execucao_plano_trabalho"), "tipoRelatorio": row.get(f"tipo_relatorio_gestao{suffix}"), "valorExecutadoDeclarado": row.get(f"valor_executado_relatorio_gestao{suffix}"),
                        "objeto": row.get("descritivo_relatorio_gestao"), "observacao": "Informação declarada pelo beneficiário; relatório final ou plano aprovado não certificam entrega ou aprovação das contas."}
                    found.append(evidence("federal", year, number, SOURCE, kind, "declared", f"{'Plano de trabalho' if kind == 'work_plan' else 'Relatório de gestão'} {identifier}", source_url, at, "ID do plano de ação com emenda previamente conferida", payload))
                    if "novos" not in endpoint:
                        continue
                    payments, paid_at, paid_url = fetch("relatorios-gestao-documento-liquidacao-especiais", "id_relatorio_gestao_novo", identifier)
                    for payment in payments:
                        found.append(evidence("federal", year, number, SOURCE, "local_payment", "declared", f"Despesa declarada {payment.get('id_relatorio_gestao_dl')}", paid_url, paid_at,
                            "Documento vinculado ao relatório pelo ID; relatório vinculado ao plano e à emenda",
                            {"idPlanoAcao": plan_id, "idRelatorio": identifier, "idDocumento": payment.get("id_relatorio_gestao_dl"), "nome": payment.get("tx_nome_recebedor_relatorio_gestao_dl"), "papel": "recebedor_declarado", "objeto": payment.get("tx_descricao_relatorio_gestao_dl"), "data": payment.get("dt_pagamento_relatorio_gestao_dl"), "valorMovimento": payment.get("vl_pagamento_relatorio_gestao_dl"), "observacao": "Despesa local declarada no relatório. Não equivale a pagamento auditado ou entrega comprovada; não somar ao repasse da União."}))
        inserted = replace_source(engine, "federal", year, SOURCE, found, count, max(times) if times else now(),
            f"{len(selected)} planos PB já carregados e vinculados ao código CGU; planos de trabalho, relatórios antigos/novos e documentos de liquidação. Não cobre outras modalidades nem planos ausentes da carga original.")
        logger.info("Federal %d: %d evidencias", year, inserted)
