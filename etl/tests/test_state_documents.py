from datetime import datetime
import unittest
import json
import tempfile
from pathlib import Path
from unittest.mock import patch
from sqlalchemy import create_engine, select, func

from etl.state import documents as pipeline
from etl.state.documents import link_documents, normalize_amendment
from etl.shared.models import StateAmendmentDestination, StateExpenseDocument, StateExpenseImport


def note(number="0799", **extra):
    return dict(ano=2024, numeroEmenda=number, codigoOrgao=250001,
                numeroEmpenho=36775, cpfCnpj="07870719000122", codigoFonteRecurso="79900", **extra)


def snapshot(notes, liquidations=None, payments=None):
    now = datetime(2026, 10, 15)
    return {("commitment", 12): (notes, now),
            ("liquidation", 12): (liquidations or [], now),
            ("payment", 12): (payments or [], now)}


class StateDocumentTests(unittest.TestCase):
    def test_interrupted_month_preserves_cache(self):
        def interrupted(*args):
            yield note()
            raise RuntimeError("interrupted")
        with tempfile.TemporaryDirectory() as directory:
            cache = Path(directory) / "notas_empenho_2024_12.json"
            cache.write_text('[{"old": true}]', encoding="utf-8")
            with patch.object(pipeline.config, "STATE_RAW_DATA_DIR", Path(directory)), \
                    patch.object(pipeline, "paginated", side_effect=interrupted):
                with self.assertRaises(RuntimeError):
                    pipeline.fetch_month("commitment", 2024, 12, refresh=True)
            self.assertEqual(json.loads(cache.read_text()), [{"old": True}])

    def test_load_is_idempotent_and_failed_collection_preserves_database(self):
        engine = create_engine("sqlite://")
        for model in [StateExpenseDocument, StateExpenseImport, StateAmendmentDestination]:
            model.__table__.create(engine)
        def fetched(kind, *args, **kwargs):
            commitment = note(valorCalculado=500, codigoNatureza="33404100", nomeMunicipio="ARACAGI")
            return ([commitment] if kind == "commitment" else []), datetime(2026, 10, 15)
        with patch.object(pipeline, "fetch_listagem", return_value=[{"emenda": "0799/2024"}]), \
                patch.object(pipeline, "fetch_month", side_effect=fetched):
            pipeline.load_documents(engine, 2024, [12])
            pipeline.load_documents(engine, 2024, [12])
        with patch.object(pipeline, "fetch_listagem", return_value=[]), \
                patch.object(pipeline, "fetch_month", side_effect=RuntimeError("network")):
            with self.assertRaises(RuntimeError):
                pipeline.load_documents(engine, 2024, [12])
        with engine.connect() as connection:
            self.assertEqual(connection.scalar(select(func.count()).select_from(StateExpenseDocument)), 1)
            self.assertEqual(connection.scalar(select(func.count()).select_from(StateExpenseImport)), 3)
            self.assertEqual(connection.scalar(select(StateAmendmentDestination.creditor_municipality_ibge)), "2500809")
            self.assertEqual(connection.scalar(select(func.count()).select_from(StateAmendmentDestination)), 1)
        engine.dispose()

    def test_exact_normalization_rejects_partial_matches_and_other_years(self):
        self.assertEqual(normalize_amendment("0799/2024", 2024), "799")
        self.assertEqual(normalize_amendment("799", 2024), "799")
        for value in ["0799/2025", "texto 0799", None, "S/I"]:
            self.assertIsNone(normalize_amendment(value, 2024))

    def test_dedup_and_year_safe_linkage(self):
        base = dict(codigoOrgao="250001", numeroEmpenho=36775,
                    cnpjCpfCredor="07.870.719/0001-22", codigoFonte="79900")
        documents, imports = link_documents(2024, [{"emenda": "0799/2024"}], snapshot(
            [note(), note()], [dict(base, anoExercicio=2024), dict(base, anoExercicio=2023)],
            [dict(base, ano=2024, codigoContaCorrente="secret")]))
        self.assertEqual(len(documents), 3)
        by_kind = {d["kind"]: d for d in documents}
        self.assertEqual(by_kind["liquidation"]["link_status"], "confirmed")
        self.assertEqual(by_kind["payment"]["link_status"], "candidate")
        self.assertNotIn("codigoContaCorrente", by_kind["payment"]["payload"])
        self.assertEqual(len(imports), 3)

    def test_collision_with_another_or_unattributed_note_blocks_link(self):
        expense = dict(codigoOrgao=250001, numeroEmpenho=36775,
                       cnpjCpfCredor="07870719000122", codigoFonte=79900, anoExercicio=2024)
        for other in ["0800", None]:
            docs, _ = link_documents(2024, [{"emenda": "0799/2024"}],
                                    snapshot([note(), note(other)], [expense]))
            self.assertFalse(any(d["kind"] == "liquidation" for d in docs))

    def test_source_or_creditor_mismatch_and_missing_keys_are_not_linked(self):
        for changes in [{"codigoFonte": "50000"}, {"cnpjCpfCredor": "00000000000000"}, {"cnpjCpfCredor": "***.000.***-**"}, {"codigoOrgao": None}]:
            expense = dict(codigoOrgao=250001, numeroEmpenho=36775,
                           cnpjCpfCredor="07870719000122", codigoFonte="79900", anoExercicio=2024)
            expense.update(changes)
            docs, _ = link_documents(2024, [{"emenda": "0799/2024"}], snapshot([note()], [expense]))
            self.assertEqual(len(docs), 1)
