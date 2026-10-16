import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from etl.federal import extract


class RefreshTests(unittest.TestCase):
    def test_refresh_bypasses_each_cache_and_preserves_it_on_failure(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(extract.config, "RAW_DATA_DIR", Path(directory)):
            for function, argument, cache in [
                (extract.fetch_emendas, 2023, "emendas_2023"),
                (extract.fetch_emenda, "123", "emenda/123"),
                (extract.fetch_documentos, "123", "documentos/123"),
            ]:
                with self.subTest(cache=cache):
                    extract.save_raw(cache, [{"old": True}])
                    client = Mock()
                    self.assertEqual(function(client, argument), [{"old": True}])
                    client.get.assert_not_called()
                    client.get.side_effect = RuntimeError("source unavailable")
                    with self.assertRaises(RuntimeError):
                        function(client, argument, refresh=True)
                    self.assertEqual(extract.load_raw(cache), [{"old": True}])
                    client.get.side_effect = None
                    client.get.return_value = []
                    self.assertEqual(function(client, argument, refresh=True), [])
                    self.assertEqual(extract.load_raw(cache), [])
