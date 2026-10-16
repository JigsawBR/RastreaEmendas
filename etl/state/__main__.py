"""ETL das emendas parlamentares estaduais da Paraiba."""

import argparse
import logging

from etl.shared.years import parse_years
from sqlalchemy import insert

from etl.shared.load import BATCH_SIZE, get_engine, init_db, upsert_rows
from etl.shared.models import EmendaEstadual, EmendaEstadualExecucao
from etl.state.extract import fetch_execucao, fetch_listagem
from etl.state.transform import (
    transform_emenda_estadual,
    transform_emenda_estadual_execucao,
)

logger = logging.getLogger("etl.state.pb")


def load_listagem(engine, year: int, *, refresh: bool = False) -> None:
    rows = [
        transform_emenda_estadual(r)
        for r in fetch_listagem(year, refresh=refresh)
    ]
    logger.info("Listagem emendas %d: %d", year, len(rows))
    upsert_rows(engine, EmendaEstadual, rows, ["ano", "numero_emenda"])


def load_execucao(engine, year: int, *, refresh: bool = False) -> None:
    rows = [
        transform_emenda_estadual_execucao(r)
        for r in fetch_execucao(year, refresh=refresh)
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
        for start in range(0, len(rows), BATCH_SIZE):
            conn.execute(insert(EmendaEstadualExecucao.__table__), rows[start:start + BATCH_SIZE])


def main() -> None:
    parser = argparse.ArgumentParser(
        description="ETL de emendas parlamentares estaduais da Paraiba"
    )
    parser.add_argument("--years", default="2024-2026")
    parser.add_argument("--documents", action="store_true", help="inclui notas, liquidacoes e pagamentos mensais")
    parser.add_argument("--refresh", action="store_true",
                        help="consulta novamente a CODATA, ignorando o cache estadual")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    engine = get_engine()
    init_db(engine)

    for year in parse_years(args.years):
        load_listagem(engine, year, refresh=args.refresh)
        load_execucao(engine, year, refresh=args.refresh)
        if args.documents:
            from etl.state.documents import load_documents
            load_documents(engine, year, refresh=args.refresh)


if __name__ == "__main__":
    main()
