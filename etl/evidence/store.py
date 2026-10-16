"""Atomic, source-scoped evidence snapshots and validated JSON caches."""
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.parse import urlencode

from sqlalchemy import delete, insert

from etl.shared.config import ROOT_DIR
from etl.shared.models import AmendmentEvidence, EvidenceImport
from etl.shared.load import BATCH_SIZE

CACHE_DIR = ROOT_DIR / "data" / "raw" / "evidence"


def now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def url(base, endpoint, params):
    return f"{base.rstrip('/')}/{endpoint.lstrip('/')}?{urlencode(params)}"


def cached(name, fetch, *, refresh=False):
    path = CACHE_DIR / f"{name}.json"
    if path.is_file() and not refresh:
        body = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(body, dict) or not isinstance(body.get("rows"), list) or any(not isinstance(r, dict) for r in body["rows"]):
            raise ValueError(f"Cache invalido: {path}")
        return body["rows"], datetime.fromisoformat(body["collected_at"])
    rows = list(fetch())
    collected_at = now()
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, suffix=".tmp", delete=False) as file:
            temporary = Path(file.name)
            json.dump({"rows": rows, "collected_at": collected_at.isoformat()}, file, ensure_ascii=False)
        temporary.replace(path)
    finally:
        if temporary:
            temporary.unlink(missing_ok=True)
    return rows, collected_at


def evidence(origin, year, number, source, kind, status, title, source_url, collected_at, match_basis, payload):
    identity = json.dumps([origin, year, number, source, kind, source_url, payload], sort_keys=True, ensure_ascii=False)
    return dict(id=sha256(identity.encode()).hexdigest(), origin=origin, year=year,
                amendment_number=number, source=source, kind=kind, status=status,
                title=title, source_url=source_url, collected_at=collected_at,
                match_basis=match_basis, payload=payload)


def replace_source(engine, origin, year, source, rows, source_count, collected_at, scope):
    rows = list({row["id"]: row for row in rows}.values())
    if any(row["origin"] != origin or row["year"] != year or row["source"] != source for row in rows):
        raise ValueError("Evidencia fora do escopo da carga")
    with engine.begin() as connection:
        connection.execute(delete(AmendmentEvidence).where(AmendmentEvidence.origin == origin,
                           AmendmentEvidence.year == year, AmendmentEvidence.source == source))
        connection.execute(delete(EvidenceImport).where(EvidenceImport.origin == origin,
                           EvidenceImport.year == year, EvidenceImport.source == source))
        for start in range(0, len(rows), BATCH_SIZE):
            connection.execute(insert(AmendmentEvidence), rows[start:start+BATCH_SIZE])
        connection.execute(insert(EvidenceImport), dict(origin=origin, year=year, source=source,
                           source_count=source_count, evidence_count=len(rows), collected_at=collected_at, scope=scope))
    return len(rows)
