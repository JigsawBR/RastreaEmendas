"""ETL das emendas parlamentares estaduais da Paraiba."""

import argparse
import logging

from .load import get_engine, init_db, insert_rows, upsert_rows
from .models import EmendaEstadual, EmendaEstadualExecucao
from .pb import BASE_ORCAMENTO, paginated
from .transform import (
    transform_emenda_estadual,
    transform_emenda_estadual_execucao,
)

logger = logging.getLogger("etl.pb")


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


def load_listagem(engine, year: int) -> None:
    rows = [
        transform_emenda_estadual(r)
        for r in paginated(BASE_ORCAMENTO, "/orcamento/listagem_emendas", {"ano": year})
    ]
    logger.info("Listagem emendas %d: %d", year, len(rows))
    upsert_rows(engine, EmendaEstadual, rows, ["ano", "numero_emenda"])


def load_execucao(engine, year: int) -> None:
    rows = [
        transform_emenda_estadual_execucao(r)
        for r in paginated(BASE_ORCAMENTO, "/orcamento/execucao_emendas", {"ano": year})
    ]
    logger.info("Execucao emendas %d: %d", year, len(rows))
    # a execucao pode ter linhas repetidas por (emenda,orgao,classificacao);
    # como o grao exato do endpoint nao esta documentado, usamos surrogate PK
    # sem unique constraint e reprocessamos zerando por ano antes de inserir
    with engine.begin() as conn:
        conn.exec_driver_sql(
            "DELETE FROM emenda_estadual_execucao WHERE ano = %s",
            (year,),
        )
    insert_rows(engine, EmendaEstadualExecucao, rows)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="ETL de emendas parlamentares estaduais da Paraiba"
    )
    parser.add_argument("--years", default="2024-2026")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    engine = get_engine()
    init_db(engine)

    for year in parse_years(args.years):
        load_listagem(engine, year)
        load_execucao(engine, year)


if __name__ == "__main__":
    main()
