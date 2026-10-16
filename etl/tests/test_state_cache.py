import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from etl.state import extract, pb
from etl.state import __main__ as pipeline


class StateCacheTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.cache_dir = Path(self.directory.name)
        patcher = patch.object(extract.config, "STATE_RAW_DATA_DIR", self.cache_dir)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_raw_rows_are_saved_per_endpoint_and_year_and_reused(self):
        for fetch, endpoint in [(extract.fetch_listagem, "listagem_emendas"),
                                (extract.fetch_execucao, "execucao_emendas")]:
            for year in [2024, 2025]:
                with self.subTest(endpoint=endpoint, year=year):
                    raw = [{"ano": year, "emenda": "001", "objeto": "Saúde", "valor": "100.000,00"}]
                    with patch.object(extract, "paginated", return_value=iter(raw)) as source:
                        self.assertEqual(fetch(year), raw)
                        source.assert_called_once_with(pb.BASE_ORCAMENTO, f"/orcamento/{endpoint}", {"ano": year})
                    cache = self.cache_dir / f"{endpoint}_{year}.json"
                    self.assertEqual(json.loads(cache.read_text(encoding="utf-8")), raw)
                    with patch.object(extract, "paginated") as source:
                        self.assertEqual(fetch(year), raw)
                        source.assert_not_called()

    def test_refresh_preserves_previous_cache_on_partial_download(self):
        def interrupted():
            yield {"new": True}
            raise RuntimeError("source unavailable")

        for fetch, endpoint in [(extract.fetch_listagem, "listagem_emendas"),
                                (extract.fetch_execucao, "execucao_emendas")]:
            with self.subTest(endpoint=endpoint):
                cache = self.cache_dir / f"{endpoint}_2024.json"
                original = '[{"old": true}]'
                cache.write_text(original, encoding="utf-8")
                with patch.object(extract, "paginated", side_effect=lambda *args: interrupted()):
                    with self.assertRaises(RuntimeError):
                        fetch(2024, refresh=True)
                self.assertEqual(cache.read_text(encoding="utf-8"), original)
                updated = [{"new": True}]
                with patch.object(extract, "paginated", return_value=iter(updated)):
                    self.assertEqual(fetch(2024, refresh=True), updated)
                self.assertEqual(json.loads(cache.read_text(encoding="utf-8")), updated)
                with patch.object(extract, "paginated", return_value=iter([])):
                    self.assertEqual(fetch(2024, refresh=True), [])
                with patch.object(extract, "paginated") as source:
                    self.assertEqual(fetch(2024), [])
                    source.assert_not_called()

    def test_failed_atomic_replace_preserves_cache_and_cleans_temporary_file(self):
        cache = self.cache_dir / "listagem_emendas_2024.json"
        cache.write_text('[{"old": true}]', encoding="utf-8")
        with patch.object(extract, "paginated", return_value=iter([{"new": True}])), \
                patch.object(Path, "replace", side_effect=OSError("write failure")):
            with self.assertRaises(OSError):
                extract.fetch_listagem(2024, refresh=True)
        self.assertEqual(json.loads(cache.read_text(encoding="utf-8")), [{"old": True}])
        self.assertEqual(list(self.cache_dir.iterdir()), [cache])

    def test_download_is_saved_before_transformation_failure(self):
        raw = [{"ano": "invalid", "emenda": "001"}]
        with patch.object(extract, "paginated", return_value=iter(raw)), \
                patch.object(pipeline, "upsert_rows") as load:
            with self.assertRaises(ValueError):
                pipeline.load_listagem(Mock(), 2024)
            load.assert_not_called()
        self.assertEqual(extract.fetch_listagem(2024), raw)

    def test_cli_forwards_refresh_to_both_loaders(self):
        for refresh in [False, True]:
            args = ["etl.state", "--years", "2024,2025"] + (["--refresh"] if refresh else [])
            with patch("sys.argv", args), patch.object(pipeline, "get_engine") as engine, \
                    patch.object(pipeline, "init_db"), \
                    patch.object(pipeline, "load_listagem") as listing, \
                    patch.object(pipeline, "load_execucao") as execution:
                pipeline.main()
                for load in [listing, execution]:
                    self.assertEqual(load.call_count, 2)
                    load.assert_any_call(engine.return_value, 2024, refresh=refresh)
                    load.assert_any_call(engine.return_value, 2025, refresh=refresh)


class StatePaginationTests(unittest.TestCase):
    def collect(self, bodies):
        session = Mock()
        session.get.side_effect = [Mock(json=Mock(return_value=body)) for body in bodies]
        with patch.object(pb, "create_session", return_value=session):
            return list(pb.paginated(pb.BASE_ORCAMENTO, "/orcamento/listagem_emendas", {"ano": 2024}))

    def test_all_pages_collected_without_changing_rows(self):
        self.assertEqual(self.collect([
            {"dados": [{"emenda": "001"}], "paginacao": {"total": 2, "pages": 2}},
            {"dados": [{"emenda": "002"}], "paginacao": {"total": 2, "pages": 2}},
        ]), [{"emenda": "001"}, {"emenda": "002"}])

    def test_incomplete_or_malformed_response_is_rejected(self):
        for bodies in [
            [{"dados": [{"emenda": "001"}], "paginacao": {"total": 2, "pages": 1}}],
            [{"dados": [], "paginacao": {"total": 2, "pages": 2}}],
            [{"error": "unavailable"}],
            [{"dados": [None]}],
        ]:
            with self.subTest(bodies=bodies), self.assertRaises(ValueError):
                self.collect(bodies)

    def test_without_page_count_uses_total_or_empty_page(self):
        self.assertEqual(self.collect([
            {"dados": [{"emenda": "001"}], "paginacao": {"total": 2}},
            {"dados": [{"emenda": "002"}], "paginacao": {"total": 2}},
        ]), [{"emenda": "001"}, {"emenda": "002"}])
        self.assertEqual(self.collect([
            {"dados": [{"emenda": "001"}]}, {"dados": []},
        ]), [{"emenda": "001"}])


if __name__ == "__main__":
    unittest.main()
