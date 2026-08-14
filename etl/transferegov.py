"""Cliente da API do Transferegov (transferencias especiais)."""

import logging
import re
from typing import Iterator

import requests

logger = logging.getLogger(__name__)

BASE = "https://api.transferegov.gestao.gov.br/transferenciasespeciais"
UA = {"User-Agent": "RastreaEmendas/1.0 (TCC IFPB)"}
PAGE_SIZE = 1000  # limite maximo do endpoint PostgREST


def paginated(endpoint: str, params: dict | None = None) -> Iterator[dict]:
    """Itera todos os registros de um endpoint, paginando via limit+offset."""
    offset = 0
    session = requests.Session()
    session.headers.update(UA)
    total = None
    while True:
        query = {**(params or {}), "limit": PAGE_SIZE, "offset": offset}
        headers = {"Prefer": "count=exact"} if total is None else {}
        r = session.get(f"{BASE}/{endpoint}", params=query, headers=headers, timeout=60)
        r.raise_for_status()
        if total is None:
            cr = r.headers.get("Content-Range", "")
            m = re.match(r"\d+-\d+/(\d+|\*)", cr)
            if m and m.group(1) != "*":
                total = int(m.group(1))
                logger.info("Transferegov %s: total %d registros", endpoint, total)
        batch = r.json()
        if not batch:
            return
        for row in batch:
            yield row
        if len(batch) < PAGE_SIZE:
            return
        offset += PAGE_SIZE
