import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from etl.federal.opendata import download_zip


class DownloadTests(unittest.TestCase):
    def test_interrupted_download_keeps_previous_cache(self):
        with tempfile.TemporaryDirectory() as directory:
            local = Path(directory) / "data.zip"
            local.write_bytes(b"previous valid cache")
            session = MagicMock()
            response = session.__enter__.return_value.get.return_value.__enter__.return_value

            def chunks():
                yield b"incomplete"
                raise ConnectionError("interrupted source")

            response.iter_content.side_effect = lambda **kwargs: chunks()
            with patch("etl.federal.opendata.create_session", return_value=session):
                with self.assertRaises(ConnectionError):
                    download_zip("https://example.test/data.zip", local)
            self.assertEqual(local.read_bytes(), b"previous valid cache")
