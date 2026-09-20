import json
import logging

from . import config
from .api_client import PortalClient
from .transform import parse_brl

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


VALOR_FIELDS = (
    "valorEmpenhado",
    "valorLiquidado",
    "valorPago",
    "valorRestoInscrito",
    "valorRestoCancelado",
    "valorRestoPago",
)

SAMPLES = 5


def grain(row: dict) -> tuple[str, str, str, str]:
    return (
        row.get("codigoEmenda") or "",
        row.get("localidadeDoGasto") or "",
        row.get("funcao") or "",
        row.get("subfuncao") or "",
    )


def _fetch_emenda_once(client: PortalClient, codigo_emenda: str) -> list[dict]:
    results: list[dict] = []
    page = 1
    previous: list[dict] | None = None
    while True:
        batch = client.get("/emendas", {"codigoEmenda": codigo_emenda, "pagina": page})
        if not batch or batch == previous:
            break
        results.extend(batch)
        previous = batch
        page += 1
    return results


def fetch_emenda(client: PortalClient, codigo_emenda: str) -> list[dict]:
    """Fetch one emenda by code, sampling the endpoint SAMPLES times and
    keeping the largest value seen for each monetary field.

    The API is not deterministic: the same request intermittently returns a
    value divided by 10,000 (e.g. "500.000,00" and "50,00" for the same row on
    consecutive calls), which looks like a non-thread-safe number formatter on
    the server. The corruption only ever shrinks the value, so the maximum
    across samples converges on the real one. See CLAUDE.md.
    """
    cached = load_raw(f"emenda/{codigo_emenda}")
    if cached is not None:
        return cached

    merged: dict[tuple[str, str, str, str], dict] = {}
    instavel: set[str] = set()
    for _ in range(SAMPLES):
        for row in _fetch_emenda_once(client, codigo_emenda):
            key = grain(row)
            atual = merged.get(key)
            if atual is None:
                merged[key] = dict(row)
                continue
            for campo in VALOR_FIELDS:
                novo, velho = parse_brl(row.get(campo)), parse_brl(atual.get(campo))
                if novo is None or velho is None or novo == velho:
                    continue
                instavel.add(campo)
                if novo > velho:
                    atual[campo] = row[campo]

    if instavel:
        logger.warning(
            "Emenda %s: API instavel em %s; mantido o maior valor de %d amostras",
            codigo_emenda, ", ".join(sorted(instavel)), SAMPLES,
        )

    results = list(merged.values())
    save_raw(f"emenda/{codigo_emenda}", results)
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
