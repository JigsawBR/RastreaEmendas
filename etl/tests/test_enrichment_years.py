import unittest

from sqlalchemy import create_engine, text

from etl.enrich_documentos import fetch_pending


class EnrichmentYearTests(unittest.TestCase):
    def test_selects_amendment_year_including_later_execution_documents(self):
        engine = create_engine("sqlite://")
        with engine.begin() as connection:
            connection.execute(text("CREATE TABLE emenda (codigo_emenda TEXT, ano INTEGER)"))
            connection.execute(text("CREATE TABLE documento_despesa (codigo_documento TEXT, codigo_emenda TEXT, detalhe_atualizado_em TEXT)"))
            connection.execute(text("INSERT INTO emenda VALUES ('a',2023),('b',2024)"))
            connection.execute(text("INSERT INTO documento_despesa VALUES ('2025OB001','a',NULL),('2023NE002','a','done'),('2024NE003','b',NULL),('2025OB001','a',NULL)"))
        self.assertEqual(fetch_pending(engine, False, None, years=[2023]), ["2025OB001"])
        self.assertEqual(fetch_pending(engine, True, None, years=[2023]), ["2023NE002", "2025OB001"])
        self.assertEqual(fetch_pending(engine, False, None, years=[]), [])
        self.assertEqual(fetch_pending(engine, False, 1, years=[2023,2024]), ["2024NE003"])
        engine.dispose()
