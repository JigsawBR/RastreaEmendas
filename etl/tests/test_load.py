import unittest
from types import SimpleNamespace

from sqlalchemy import Column, Integer, MetaData, String, Table, create_engine, select

from etl.load import upsert_rows


class UpsertTests(unittest.TestCase):
    def test_partial_reload_preserves_enrichment_and_identity(self):
        engine = create_engine("sqlite://")
        table = Table("documents", MetaData(),
                      Column("id", Integer, primary_key=True),
                      Column("code", String, unique=True),
                      Column("stage", String), Column("enrichment", String))
        table.create(engine)
        model = SimpleNamespace(__table__=table)
        upsert_rows(engine, model, [{"code": "a", "stage": "old", "enrichment": "kept"}], ["code"])
        with engine.connect() as conn:
            original_id = conn.execute(select(table.c.id)).scalar_one()
        # Mixed field sets must retain omitted values but allow explicit NULLs.
        upsert_rows(engine, model, [
            {"code": "a", "stage": "new"},
            {"code": "b", "enrichment": "other"},
            {"code": "b", "enrichment": None},
            {"code": "a"},
        ], ["code"])
        with engine.connect() as conn:
            rows = {r.code: r for r in conn.execute(select(table))}
        self.assertEqual(rows["a"].id, original_id)
        self.assertEqual(rows["a"].stage, "new")
        self.assertEqual(rows["a"].enrichment, "kept")
        self.assertIsNone(rows["b"].enrichment)
        engine.dispose()


if __name__ == "__main__":
    unittest.main()
