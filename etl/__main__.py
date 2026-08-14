import argparse
import logging
from collections import Counter
from decimal import Decimal

from .api_client import PortalClient
from .extract import fetch_documentos, fetch_emendas
from .load import get_engine, init_db, upsert_rows
from .models import DocumentoDespesa, Emenda, EmendaAlocacao
from .transform import (
    is_localidade_uf,
    transform_alocacao,
    transform_documento,
    transform_emenda,
)

logger = logging.getLogger("etl")

UF_NOMES = {"PB": "PARAÍBA"}


def parse_years(spec: str) -> list[int]:
    """Accept "2024", "2020-2025", "2022,2024", "2020-2023,2025"."""
    years: set[int] = set()
    for piece in spec.split(","):
        piece = piece.strip()
        if "-" in piece:
            start, end = piece.split("-")
            years.update(range(int(start), int(end) + 1))
        else:
            years.add(int(piece))
    return sorted(years)


def run_year(client: PortalClient, engine, year: int, uf: str, skip_documentos: bool) -> None:
    uf_nome = UF_NOMES[uf]
    raw_rows = fetch_emendas(client, year)
    uf_rows = [
        r for r in raw_rows
        if is_localidade_uf(r.get("localidadeDoGasto"), uf, uf_nome)
    ]

    emendas = {r["codigoEmenda"]: transform_emenda(r) for r in uf_rows}
    alocacoes = [transform_alocacao(r) for r in uf_rows]
    upsert_rows(engine, Emenda, list(emendas.values()), ["codigo_emenda"])
    upsert_rows(
        engine, EmendaAlocacao, alocacoes,
        ["codigo_emenda", "localidade_gasto", "funcao", "subfuncao"],
    )

    total_empenhado = sum((a["valor_empenhado"] or Decimal(0)) for a in alocacoes)
    total_pago = sum((a["valor_pago"] or Decimal(0)) for a in alocacoes)
    localidades = {a["localidade_gasto"] for a in alocacoes}
    logger.info(
        "Year %d (%s): %d emendas, %d alocacoes, %d localidades | empenhado R$ %s | pago R$ %s",
        year, uf, len(emendas), len(alocacoes), len(localidades),
        f"{total_empenhado:,.2f}", f"{total_pago:,.2f}",
    )

    if skip_documentos:
        return

    # a API repete documentos com "id" interno distinto e demais campos
    # identicos, por isso a deduplicacao pela chave de negocio
    docs_by_key: dict[tuple[str, str], dict] = {}
    raw_doc_count = 0
    all_codigos = sorted(emendas)
    # "S/I" (Sem Informacao) aparece como codigoEmenda em algumas linhas e
    # nao pode ser consultado no endpoint de documentos
    codigos = [c for c in all_codigos if c.isdigit()]
    invalid = [c for c in all_codigos if not c.isdigit()]
    if invalid:
        logger.warning("Year %d: %d emendas without valid codigo skipped: %s", year, len(invalid), invalid)
    for i, codigo in enumerate(codigos, start=1):
        raw_docs = fetch_documentos(client, codigo)
        raw_doc_count += len(raw_docs)
        for d in raw_docs:
            row = transform_documento(d, codigo)
            docs_by_key[(row["codigo_documento"], row["codigo_emenda"])] = row
        if i % 20 == 0:
            logger.info("Year %d: documentos fetched for %d/%d emendas", year, i, len(codigos))

    doc_rows = list(docs_by_key.values())
    if raw_doc_count != len(doc_rows):
        logger.info("Year %d: %d duplicated documentos collapsed", year, raw_doc_count - len(doc_rows))
    upsert_rows(engine, DocumentoDespesa, doc_rows, ["codigo_documento", "codigo_emenda"])
    fases = Counter(d["estagio"] for d in doc_rows)
    logger.info("Year %d: %d documentos | fases: %s", year, len(doc_rows), dict(fases))


def main() -> None:
    parser = argparse.ArgumentParser(
        description="ETL de emendas parlamentares da Paraiba (Portal da Transparencia)"
    )
    parser.add_argument("--years", default="2020-2025", help="ex.: 2024 | 2020-2025 | 2022,2024")
    parser.add_argument("--uf", default="PB", choices=sorted(UF_NOMES))
    parser.add_argument("--skip-documentos", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    client = PortalClient()
    engine = get_engine()
    init_db(engine)

    for year in parse_years(args.years):
        run_year(client, engine, year, args.uf, args.skip_documentos)


if __name__ == "__main__":
    main()
