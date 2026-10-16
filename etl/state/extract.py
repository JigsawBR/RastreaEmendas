"""Raw CODATA snapshots, reused before transformation and database loading."""

import json
import logging
from pathlib import Path
from tempfile import NamedTemporaryFile

from etl.shared import config
from etl.state.pb import BASE_ORCAMENTO, paginated

logger = logging.getLogger(__name__)


def _fetch(endpoint: str, year: int, *, refresh: bool = False) -> list[dict]:
    cache = config.STATE_RAW_DATA_DIR / f"{endpoint}_{year}.json"
    if not refresh and cache.is_file():
        rows = json.loads(cache.read_text(encoding="utf-8"))
        if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
            raise ValueError(f"Cache estadual invalido: {cache}. Use --refresh para coletar novamente.")
        logger.info("PB %s %d: %d registros do cache %s", endpoint, year, len(rows), cache)
        return rows

    rows = list(paginated(BASE_ORCAMENTO, f"/orcamento/{endpoint}", {"ano": year}))
    cache.parent.mkdir(parents=True, exist_ok=True)
    # Replace only after a complete download and successful serialization.
    temporary: Path | None = None
    try:
        with NamedTemporaryFile(mode="w", encoding="utf-8", dir=cache.parent,
                                prefix=f".{cache.stem}_", suffix=".tmp", delete=False) as handle:
            temporary = Path(handle.name)
            json.dump(rows, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        temporary.replace(cache)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    logger.info("PB %s %d: %d registros salvos em %s", endpoint, year, len(rows), cache)
    return rows


def fetch_listagem(year: int, *, refresh: bool = False) -> list[dict]:
    return _fetch("listagem_emendas", year, refresh=refresh)


def fetch_execucao(year: int, *, refresh: bool = False) -> list[dict]:
    return _fetch("execucao_emendas", year, refresh=refresh)
