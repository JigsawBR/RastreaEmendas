"""ETL das despesas mensais federais (arquivos abertos da CGU)."""

import argparse
import logging

from .load import get_engine, init_db, insert_rows
from .models import DespesaMensal
from .opendata import download_despesas_zip, read_despesas
from .transform import transform_despesa_mensal

logger = logging.getLogger("etl.despesas")


def parse_years(spec: str) -> list[int]:
    years: set[int] = set()
    for piece in spec.split(","):
        piece = piece.strip()
        if "-" in piece:
            start, end = piece.split("-")
            years.update(range(int(start), int(end) + 1))
        else:
            years.add(int(piece))
    return sorted(years)


def run_month(engine, year: int, month: int, uf: str) -> None:
    aaaamm = f"{year:04d}/{month:02d}"
    zip_path = download_despesas_zip(year, month)
    df = read_despesas(zip_path, uf=uf, only_emenda=True)
    logger.info("%s (%s, com emenda): %d linhas", aaaamm, uf, len(df))
    rows = [transform_despesa_mensal(r) for r in df.to_dict(orient="records")]

    with engine.begin() as conn:
        conn.exec_driver_sql(
            "DELETE FROM despesa_mensal WHERE ano_mes = %s",
            (aaaamm,),
        )
    insert_rows(engine, DespesaMensal, rows)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="ETL das despesas mensais federais (recorte PB, com emenda)"
    )
    parser.add_argument("--years", default="2024-2026")
    parser.add_argument("--uf", default="PB")
    parser.add_argument("--months", default="1-12", help="ex.: 1-12 | 1,6,12")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    engine = get_engine()
    init_db(engine)

    months = parse_years(args.months)  # mesmo parser
    for year in parse_years(args.years):
        for month in months:
            if not 1 <= month <= 12:
                continue
            try:
                run_month(engine, year, month, args.uf)
            except Exception as exc:
                logger.error("Falha em %04d-%02d: %s", year, month, exc)


if __name__ == "__main__":
    main()
