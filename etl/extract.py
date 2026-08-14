import json
import logging

from . import config
from .api_client import PortalClient

logger = logging.getLogger(__name__)


def fetch_emendas(client: PortalClient, year: int) -> list[dict]:
    """Fetch all /emendas rows for a year. The API has no UF filter (checked
    in the OpenAPI spec), so this returns the whole country; filter locally."""
    cached = load_raw(f"emendas_{year}")
    if cached is not None:
        logger.info("Year %d: %d rows loaded from cache", year, len(cached))
        return cached
    results: list[dict] = []
    page = 1
    while True:
        batch = client.get("/emendas", {"ano": year, "pagina": page})
        if not batch:
            break
        results.extend(batch)
        page += 1
    logger.info("Year %d: %d rows fetched (%d pages)", year, len(results), page - 1)
    save_raw(f"emendas_{year}", results)
    return results


def fetch_documentos(client: PortalClient, codigo_emenda: str) -> list[dict]:
    cached = load_raw(f"documentos/{codigo_emenda}")
    if cached is not None:
        return cached
    results: list[dict] = []
    page = 1
    previous: list[dict] | None = None
    while True:
        batch = client.get(f"/emendas/documentos/{codigo_emenda}", {"pagina": page})
        # guard: some endpoints ignore "pagina" and repeat the same payload
        if not batch or batch == previous:
            break
        results.extend(batch)
        previous = batch
        page += 1
    save_raw(f"documentos/{codigo_emenda}", results)
    return results


def load_raw(relative_name: str):
    path = config.RAW_DATA_DIR / f"{relative_name}.json"
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def save_raw(relative_name: str, payload) -> None:
    path = config.RAW_DATA_DIR / f"{relative_name}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
