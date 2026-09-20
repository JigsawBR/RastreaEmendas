import logging
from itertools import groupby

from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import insert

from . import config
from .models import Base

logger = logging.getLogger(__name__)

BATCH_SIZE = 500


def get_engine():
    return create_engine(config.DATABASE_URL)


def init_db(engine) -> None:
    Base.metadata.create_all(engine)


def insert_rows(engine, model, rows: list[dict]) -> int:
    if not rows:
        return 0
    table = model.__table__
    with engine.begin() as conn:
        for start in range(0, len(rows), BATCH_SIZE):
            conn.execute(insert(table), rows[start : start + BATCH_SIZE])
    logger.info("Inserted %d rows into %s", len(rows), table.name)
    return len(rows)


def upsert_rows(engine, model, rows: list[dict], key_columns: list[str]) -> int:
    if not rows:
        return 0
    table = model.__table__
    with engine.begin() as conn:
        # Keep input order and distinguish omitted fields from explicit NULLs.
        for fields, group in groupby(rows, key=lambda row: tuple(sorted(row))):
            group_rows = list(group)
            for start in range(0, len(group_rows), BATCH_SIZE):
                batch = group_rows[start : start + BATCH_SIZE]
                stmt = insert(table).values(batch)
                update_cols = {
                    name: stmt.excluded[name]
                    for name in fields
                    if name not in key_columns
                }
                if update_cols:
                    stmt = stmt.on_conflict_do_update(
                        index_elements=key_columns, set_=update_cols
                    )
                else:
                    stmt = stmt.on_conflict_do_nothing(index_elements=key_columns)
                conn.execute(stmt)
    logger.info("Upserted %d rows into %s", len(rows), table.name)
    return len(rows)
