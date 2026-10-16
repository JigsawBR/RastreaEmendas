"""Cliente da API do Portal de Dados Abertos da Paraiba."""

import logging
import os
from typing import Iterator

from etl.shared.http import create_session

logger = logging.getLogger(__name__)

BASE_ORCAMENTO = os.getenv("PB_API_BASE_URL", "https://api.dados.pb.gov.br/api/v1")
UA = {"User-Agent": "RastreaEmendas/1.0 (TCC IFPB)"}
PAGE_SIZE = 500


def paginated(base_url: str, endpoint: str, params: dict) -> Iterator[dict]:
    session = create_session(UA)
    page = 1
    total: int | None = None
    fetched = 0
    while True:
        q = {**params, "page": page, "per_page": PAGE_SIZE}
        r = session.get(f"{base_url}{endpoint}", params=q, timeout=60)
        r.raise_for_status()
        body = r.json()
        if not isinstance(body, dict) or not isinstance(body.get("dados"), list):
            raise ValueError(f"PB {endpoint}: resposta sem lista de dados")
        pag = body.get("paginacao") or {}
        if total is None:
            total = int(pag["total"]) if pag.get("total") is not None else None
            if total is not None:
                logger.info("PB %s: total %d registros", endpoint, total)
        rows = body.get("dados") or []
        if not rows:
            if total is not None and fetched != total:
                raise ValueError(f"PB {endpoint}: coleta incompleta ({fetched}/{total})")
            return
        for row in rows:
            if not isinstance(row, dict):
                raise ValueError(f"PB {endpoint}: registro invalido")
            yield row
        fetched += len(rows)
        pages = pag.get("pages") or pag.get("total_paginas")
        if pages is not None and page >= int(pages):
            if total is not None and fetched != total:
                raise ValueError(f"PB {endpoint}: coleta incompleta ({fetched}/{total})")
            return
        if pages is None and total is not None and fetched >= total:
            if fetched != total:
                raise ValueError(f"PB {endpoint}: total divergente ({fetched}/{total})")
            return
        page += 1
