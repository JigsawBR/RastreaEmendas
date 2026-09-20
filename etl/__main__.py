import argparse
import logging
from collections import Counter
from decimal import Decimal

from sqlalchemy import text

from .api_client import PortalClient
from .extract import VALOR_FIELDS, fetch_documentos, fetch_emenda, fetch_emendas, grain
from .load import get_engine, init_db, upsert_rows
from .models import DocumentoDespesa, Emenda, EmendaAlocacao
from .transform import (
    is_localidade_uf,
    parse_brl,
    transform_alocacao,
    transform_documento,
    transform_emenda,
)
from .validate_empenhos import aplicar_correcoes

logger = logging.getLogger("etl")

UF_NOMES = {"PB": "PARAÍBA"}

# assinatura da corrupcao intermitente da API: o valor errado e o certo / 10.000
CORRUPTION_FACTOR = Decimal(10000)

TOTAIS_SQL = text("""
    SELECT COALESCE(SUM(a.valor_empenhado), 0), COALESCE(SUM(a.valor_pago), 0)
    FROM emenda_alocacao a JOIN emenda e ON e.codigo_emenda = a.codigo_emenda
    WHERE e.ano = :ano
""")


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


def revalidate_valores(client: PortalClient, year: int, rows: list[dict]) -> list[dict]:
    """Cross-check the values from the year listing against fetch_emenda.

    The detail wins by default: it is sampled several times and the listing is
    read from a cache that may be weeks old, so a plain divergence usually means
    the figure was updated at the source. The exception is the corruption
    signature (listing == detail x 10,000), where the detail lost every sample
    and the listing holds the real value. Every divergence is logged as evidence.
    """
    codigos = sorted({r["codigoEmenda"] for r in rows if str(r.get("codigoEmenda", "")).isdigit()})
    detalhe: dict[tuple[str, str, str, str], dict] = {}
    for i, codigo in enumerate(codigos, start=1):
        try:
            for r in fetch_emenda(client, codigo):
                detalhe[grain(r)] = r
        except Exception as exc:
            logger.warning("Year %d: falha ao revalidar %s: %s", year, codigo, exc)
        if i % 20 == 0:
            logger.info("Year %d: valores revalidados para %d/%d emendas", year, i, len(codigos))

    revalidadas: list[dict] = []
    divergentes = sem_correspondencia = 0
    delta = Decimal(0)
    for row in rows:
        ref = detalhe.get(grain(row))
        if ref is None:
            sem_correspondencia += 1
            revalidadas.append(row)
            continue

        corrigida = dict(row)
        diff: list[str] = []
        for campo in VALOR_FIELDS:
            na_listagem, no_detalhe = parse_brl(row.get(campo)), parse_brl(ref.get(campo))
            if no_detalhe is None or na_listagem is None or no_detalhe == na_listagem:
                continue
            detalhe_corrompido = na_listagem == no_detalhe * CORRUPTION_FACTOR
            if not detalhe_corrompido:
                corrigida[campo] = ref[campo]
            diff.append(
                f"{campo}: listagem {row[campo]!r} x detalhe {ref[campo]!r} -> "
                f"{'listagem (detalhe corrompido)' if detalhe_corrompido else 'detalhe'}"
            )
            if campo == "valorEmpenhado":
                delta += (na_listagem if detalhe_corrompido else no_detalhe) - na_listagem
        if diff:
            divergentes += 1
            logger.warning(
                "Divergencia %s (%s / %s): %s",
                row["codigoEmenda"], row.get("localidadeDoGasto"), row.get("funcao"),
                "; ".join(diff),
            )
        revalidadas.append(corrigida)

    logger.info(
        "Year %d: %d/%d linhas divergentes | %d sem correspondencia | "
        "delta empenhado R$ %s",
        year, divergentes, len(rows), sem_correspondencia, f"{delta:,.2f}",
    )
    return revalidadas


def run_year(client: PortalClient, engine, year: int, uf: str, skip_documentos: bool) -> None:
    uf_nome = UF_NOMES[uf]
    raw_rows = fetch_emendas(client, year)
    uf_rows = [
        r for r in raw_rows
        if is_localidade_uf(r.get("localidadeDoGasto"), uf, uf_nome)
    ]

    uf_rows = revalidate_valores(client, year, uf_rows)

    emendas = {r["codigoEmenda"]: transform_emenda(r) for r in uf_rows}
    alocacoes = [transform_alocacao(r) for r in uf_rows]
    upsert_rows(engine, Emenda, list(emendas.values()), ["codigo_emenda"])
    upsert_rows(
        engine, EmendaAlocacao, alocacoes,
        ["codigo_emenda", "localidade_gasto", "funcao", "subfuncao"],
    )
    # a carga acabou de sobrescrever valor_empenhado com o que veio da API, o
    # que desfaz o que ja foi confirmado pela soma dos empenhos
    restauradas = aplicar_correcoes(engine)
    if restauradas:
        logger.info("Year %d: %d correcoes reaplicadas apos a carga", year, restauradas)

    # totais lidos do banco, e nao das linhas em memoria, para refletirem as
    # correcoes reaplicadas acima
    with engine.connect() as conn:
        total_empenhado, total_pago = conn.execute(TOTAIS_SQL, {"ano": year}).one()
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
