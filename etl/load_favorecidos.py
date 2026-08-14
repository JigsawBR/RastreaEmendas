"""ETL dos favorecidos PB a partir do arquivo aberto do Portal."""

import argparse
import logging

from .load import get_engine, init_db, upsert_rows
from .models import Favorecido
from .opendata import download_emendas_zip, read_por_favorecido
from .transform import transform_favorecido

logger = logging.getLogger("etl.favorecidos")


def parse_years(spec: str) -> set[int]:
    years: set[int] = set()
    for piece in spec.split(","):
        piece = piece.strip()
        if "-" in piece:
            start, end = piece.split("-")
            years.update(range(int(start), int(end) + 1))
        else:
            years.add(int(piece))
    return years


def run(engine, uf: str, years: set[int]) -> None:
    zip_path = download_emendas_zip()
    df = read_por_favorecido(zip_path)
    logger.info("PorFavorecido (Brasil, histórico): %d linhas", len(df))

    year_prefixes = {str(y) for y in years}
    df = df[df["UF Favorecido"] == uf]
    df = df[df["Ano/Mês"].str[:4].isin(year_prefixes)]
    logger.info("Recorte %s %s: %d linhas", uf, sorted(years), len(df))

    rows: list[dict] = []
    for row in df.to_dict(orient="records"):
        transformed = transform_favorecido(row)
        if transformed:
            rows.append(transformed)

    # a chave de negocio (codigoEmenda, ano_mes, codigoFavorecido) pode se
    # repetir dentro do mesmo mes (mais de um lancamento) — somamos os valores
    grouped: dict[tuple, dict] = {}
    for r in rows:
        key = (r["codigo_emenda"], r["ano_mes"], r["codigo_favorecido"])
        if key in grouped:
            existing = grouped[key]
            if existing["valor_recebido"] is not None and r["valor_recebido"] is not None:
                existing["valor_recebido"] += r["valor_recebido"]
        else:
            grouped[key] = r
    collapsed = list(grouped.values())
    if len(collapsed) != len(rows):
        logger.info("%d lançamentos duplicados colapsados", len(rows) - len(collapsed))

    upsert_rows(
        engine, Favorecido, collapsed,
        ["codigo_emenda", "ano_mes", "codigo_favorecido"],
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Carga da tabela Favorecido a partir do arquivo aberto da CGU"
    )
    parser.add_argument("--years", default="2024-2026")
    parser.add_argument("--uf", default="PB")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    engine = get_engine()
    init_db(engine)
    run(engine, args.uf, parse_years(args.years))


if __name__ == "__main__":
    main()
