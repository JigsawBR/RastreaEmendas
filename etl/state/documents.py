"""Documentary trail for state amendments; no federal identifiers are used.

Monthly downloads are cached before linking. A failed download never replaces a
database snapshot. Payment-year-only links remain candidates (restos a pagar).
"""

import argparse
from collections import defaultdict
from datetime import datetime, timezone
from hashlib import sha256
import json
import logging
import re
from pathlib import Path
from tempfile import NamedTemporaryFile

import requests
from sqlalchemy import delete, insert

from etl.shared import config
from etl.shared.load import BATCH_SIZE, get_engine, init_db
from etl.shared.models import StateExpenseDocument, StateExpenseImport
from etl.shared.years import parse_years
from etl.state.extract import fetch_listagem
from etl.state.pb import BASE_ORCAMENTO, paginated

ENDPOINTS = {
    "commitment": "notas_empenho",
    "liquidation": "liquidacoes",
    "payment": "autorizacoes_pagamento",
}
# Never persist bank details or unrelated fields from the payment response.
FIELDS = set("""ano anoExercicio mes codigoOrgao nomeOrgao codigoUnidade
numeroEmpenho dataEmpenho numeroEmenda tipoNotaEmpenho descricaoTipo
descricaoEmpenho nomeCredor cpfCnpj cnpjCpfCredor registroCGE processo contrato
codigoNatureza nomeNatureza codigoFonteRecurso codigoFonte descricaoFonteRecurso
codigoFuncao nomeFuncao codigoSubfuncao nomeSubfuncao codigoPrograma nomePrograma
codigoAcao nomeAcao codigoFinalidade nomeFinalidade nomeMunicipio ufMunicipio
valorEmpenhado valorCalculado valorSuplementado valorLiquidado valorAnulado
valorPago valorPagamentoAnulado valorDespesa dataMovimento numeroDocumento
tipoLiquidacao valorAnuladoLD valorGD dataPagamento tipoPagamento valorLiquido
valorDesconto""".split())


def normalize_amendment(value, year: int) -> str | None:
    match = re.fullmatch(r"\s*(\d+)(?:\s*/\s*(\d{4}))?\s*", str(value or ""))
    if not match or (match[2] and int(match[2]) != year):
        return None
    return str(int(match[1]))


def _code(value) -> str:
    text = str(value or "").strip()
    return str(int(text)) if text.isdigit() else text


def expense_key(row: dict) -> tuple[str, str, str, str] | None:
    """Require organ, commitment, creditor and funding source, never just value."""
    creditor = str(row.get("cpfCnpj") or row.get("cnpjCpfCredor") or "")
    digits = re.sub(r"\D", "", creditor)
    if "*" in creditor or len(digits) not in (11, 14):
        return None
    values = (
        _code(row.get("codigoOrgao")), _code(row.get("numeroEmpenho")),
        digits,
        _code(row.get("codigoFonteRecurso") or row.get("codigoFonte")),
    )
    return values if all(values) else None


def fetch_month(kind: str, year: int, month: int, *, refresh=False):
    cache = config.STATE_RAW_DATA_DIR / f"{ENDPOINTS[kind]}_{year}_{month:02}.json"
    if cache.is_file() and not refresh:
        rows = json.loads(cache.read_text(encoding="utf-8"))
        if not isinstance(rows, list) or any(not isinstance(r, dict) for r in rows):
            raise ValueError(f"Cache invalido: {cache}")
        return rows, datetime.fromtimestamp(cache.stat().st_mtime, timezone.utc).replace(tzinfo=None)
    try:
        rows = list(paginated(BASE_ORCAMENTO, f"/despesas/{ENDPOINTS[kind]}",
                              {"ano": year, "mes": month}))
    except requests.HTTPError as error:
        response = error.response
        # Only the documented no-data response is an empty month, never an
        # arbitrary 404 from a proxy or an interrupted subsequent page.
        if response is None or response.status_code != 404 or not response.url:
            raise
        message = response.json().get("message", "")
        from urllib.parse import parse_qs, urlparse
        page = parse_qs(urlparse(response.url).query).get("page", ["1"])[0]
        if page != "1" or not message.startswith("Nenhum dado encontrado"):
            raise
        rows = []
    # Retain only an allowlist, including in the local cache.
    rows = [{k: v for k, v in row.items() if k in FIELDS} for row in rows]
    cache.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with NamedTemporaryFile(mode="w", encoding="utf-8", dir=cache.parent,
                                suffix=".tmp", delete=False) as handle:
            temporary = Path(handle.name)
            json.dump(rows, handle, ensure_ascii=False)
        temporary.replace(cache)
    finally:
        if temporary:
            temporary.unlink(missing_ok=True)
    return rows, datetime.fromtimestamp(cache.stat().st_mtime, timezone.utc).replace(tzinfo=None)


def link_documents(year: int, listings: list[dict], snapshots: dict):
    known = {normalize_amendment(row.get("emenda"), year) for row in listings}
    known.discard(None)
    # Index ALL notes, including non-amendment notes: a collision must never
    # silently assign an ordinary expense to an amendment.
    index = defaultdict(set)
    for (kind, _), (rows, _) in snapshots.items():
        if kind != "commitment":
            continue
        for row in rows:
            key = expense_key(row)
            if key:
                index[key].add(normalize_amendment(row.get("numeroEmenda"), year))
    documents = {}
    imports = []
    for (kind, month), (rows, collected_at) in snapshots.items():
        linked = 0
        for raw in rows:
            row = {k: v for k, v in raw.items() if k in FIELDS}
            status = "confirmed"
            if kind == "commitment":
                if int(row.get("ano") or 0) != year:
                    continue
                number = normalize_amendment(row.get("numeroEmenda"), year)
            else:
                candidates = index.get(expense_key(row), set())
                if len(candidates) != 1:
                    continue
                number = next(iter(candidates))
                if row.get("anoExercicio") is not None:
                    if int(row["anoExercicio"]) != year:
                        continue
                else:
                    status = "candidate"
            if number not in known:
                continue
            linked += 1
            identity = json.dumps([year, kind, row], sort_keys=True, ensure_ascii=False)
            digest = sha256(identity.encode()).hexdigest()
            documents[digest] = dict(
                id=digest, year=year, month=month, amendment_number=number,
                kind=kind, link_status=status, payload=row, collected_at=collected_at,
                source_url=f"{BASE_ORCAMENTO}/despesas/{ENDPOINTS[kind]}?ano={year}&mes={month}",
            )
        imports.append(dict(year=year, month=month, kind=kind,
                            source_count=len(rows), linked_count=linked, collected_at=collected_at))
    return list(documents.values()), imports


def load_documents(engine, year: int, months=None, *, refresh=False):
    if months is None:
        today = datetime.now().date()
        if year > today.year:
            raise ValueError("Exercicio futuro nao pode ser coletado")
        months = range(1, (today.month if year == today.year else 12) + 1)
    listings = fetch_listagem(year, refresh=refresh)
    snapshots = {}
    for kind in ENDPOINTS:
        for month in months:
            logging.info("PB documentos: %s %d-%02d", kind, year, month)
            snapshots[kind, month] = fetch_month(kind, year, month, refresh=refresh)
    documents, imports = link_documents(year, listings, snapshots)
    # The selected months constitute a new YEAR snapshot. Partial scope is
    # explicit in import metadata and the UI; no mixture of stale links.
    with engine.begin() as connection:
        for model, rows in [(StateExpenseDocument, documents), (StateExpenseImport, imports)]:
            connection.execute(delete(model).where(model.year == year))
            for start in range(0, len(rows), BATCH_SIZE):
                connection.execute(insert(model), rows[start:start + BATCH_SIZE])
    logging.info("PB %d: %d documentos vinculados", year, len(documents))


def main():
    parser = argparse.ArgumentParser(description="Documentos das emendas estaduais da Paraiba")
    parser.add_argument("--years", default="2024-2026")
    parser.add_argument("--months", help="escopo da nova carga anual; padrao ate o mes atual (substitui o anterior)")
    parser.add_argument("--refresh", action="store_true")
    args = parser.parse_args()
    months = parse_years(args.months) if args.months else None
    if months is not None and (not months or any(m < 1 or m > 12 for m in months)):
        parser.error("--months deve conter meses de 1 a 12")
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    engine = get_engine()
    init_db(engine)
    for year in parse_years(args.years):
        load_documents(engine, year, months, refresh=args.refresh)


if __name__ == "__main__":
    main()
