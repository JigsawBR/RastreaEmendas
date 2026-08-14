"""Cliente da API do Portal de Dados Abertos da Paraiba."""

import logging
from typing import Iterator

import requests

logger = logging.getLogger(__name__)

BASE_ORCAMENTO = "https://api.dadosabertos.codata.pb.gov.br/api/v1"
UA = {"User-Agent": "RastreaEmendas/1.0 (TCC IFPB)"}
PAGE_SIZE = 500


def paginated(base_url: str, endpoint: str, params: dict) -> Iterator[dict]:
    session = requests.Session()
    session.headers.update(UA)
    page = 1
    total: int | None = None
    while True:
        q = {**params, "page": page, "per_page": PAGE_SIZE}
        r = session.get(f"{base_url}{endpoint}", params=q, timeout=60)
        r.raise_for_status()
        body = r.json()
        pag = body.get("paginacao") or {}
        if total is None:
            total = pag.get("total")
            if total is not None:
                logger.info("PB %s: total %d registros", endpoint, total)
        rows = body.get("dados") or []
        if not rows:
            return
        for row in rows:
            yield row
        pages = pag.get("pages") or pag.get("total_paginas")
        if pages is None or page >= pages:
            return
        page += 1
