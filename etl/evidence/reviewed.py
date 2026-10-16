"""Import a reviewed public document for one amendment, with an explicit audit trail."""
import argparse
import json
from pathlib import Path
from urllib.parse import urlparse
from sqlalchemy import delete, insert, select, func
from etl.shared.load import get_engine, init_db
from etl.shared.models import AmendmentEvidence, EvidenceImport, Emenda, EmendaEstadual
from etl.evidence.store import evidence, now
from etl.state.documents import normalize_amendment

SOURCE = "reviewed_documents"
ALLOWED = {"nome", "papel", "processo", "documentoUrl", "objeto", "trecho", "data", "observacao", "revisadoPor", "revisadoEm"}


def validate_document(row):
    if not isinstance(row, dict) or set(row) != {"kind", "title", "source_url", "match_basis", "payload"}:
        raise ValueError("Documento deve ter kind, title, source_url, match_basis e payload")
    if row["kind"] not in {"original_request", "delivery", "accountability"}:
        raise ValueError("Tipo de documento nao permitido")
    for key in ["title", "source_url", "match_basis"]:
        if not isinstance(row[key], str) or not row[key].strip():
            raise ValueError(f"Campo obrigatorio: {key}")
    p = row["payload"]
    if not isinstance(p, dict) or set(p) - ALLOWED or any(not isinstance(v, str) for v in p.values()):
        raise ValueError("Payload invalido: apenas campos textuais documentados, sem CPF ou conta bancaria")
    for key in ["documentoUrl", "trecho", "processo", "revisadoPor", "revisadoEm"]:
        if not p.get(key, "").strip():
            raise ValueError(f"Campo obrigatorio no payload: {key}")
    from datetime import date
    date.fromisoformat(p["revisadoEm"])
    if row["kind"] == "original_request" and (not p.get("nome") or p.get("papel") != "demandante_original"):
        raise ValueError("Solicitacao exige nome e papel demandante_original documentados")
    for value in [row["source_url"], p["documentoUrl"]]:
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError("URL publica HTTP(S) obrigatoria")
    return row


def import_documents(engine, origin, year, number, rows):
    if origin not in {"state", "federal"}:
        raise ValueError("Origem invalida")
    if origin == "state":
        number = normalize_amendment(number, year)
    if not number:
        raise ValueError("Numero de emenda invalido")
    # Validate the complete file before opening a write transaction.
    rows = [validate_document(r) for r in rows]
    if not rows:
        raise ValueError("Arquivo vazio nao substitui documentos revisados")
    at = now()
    records = [evidence(origin, year, number, SOURCE, r["kind"], "reviewed", r["title"], r["source_url"], at, r["match_basis"], r["payload"]) for r in rows]
    records = list({r["id"]: r for r in records}.values())
    with engine.begin() as connection:
        if origin == "state":
            numbers = connection.execute(select(EmendaEstadual.numero_emenda).where(EmendaEstadual.ano == year)).scalars()
            exists = any(normalize_amendment(n, year) == number for n in numbers)
        else:
            exists = connection.execute(select(Emenda.codigo_emenda).where(Emenda.ano == year, Emenda.codigo_emenda == number)).first() is not None
        if not exists:
            raise ValueError("Emenda nao carregada no sistema")
        scope = (AmendmentEvidence.origin == origin, AmendmentEvidence.year == year, AmendmentEvidence.source == SOURCE)
        connection.execute(delete(AmendmentEvidence).where(*scope, AmendmentEvidence.amendment_number == number))
        connection.execute(insert(AmendmentEvidence), records)
        count = connection.execute(select(func.count()).select_from(AmendmentEvidence).where(*scope)).scalar_one()
        connection.execute(delete(EvidenceImport).where(EvidenceImport.origin == origin, EvidenceImport.year == year, EvidenceImport.source == SOURCE))
        connection.execute(insert(EvidenceImport), dict(origin=origin, year=year, source=SOURCE, source_count=count, evidence_count=count, collected_at=at,
            scope="Importação manual de documentos públicos com trecho, processo e revisão registrados. Documento revisado não certifica execução integral nem regularidade das contas."))
    return len(records)


def main():
    parser = argparse.ArgumentParser(description="Importar evidencias documentais publicas revisadas")
    parser.add_argument("--file", type=Path, required=True)
    parser.add_argument("--origin", choices=["state", "federal"], required=True)
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--number", required=True)
    args = parser.parse_args()
    rows = json.loads(args.file.read_text(encoding="utf-8"))
    if not isinstance(rows, list):
        parser.error("Arquivo deve conter uma lista de documentos")
    engine = get_engine()
    try:
        init_db(engine)
        print(f"Documentos importados: {import_documents(engine, args.origin, args.year, args.number, rows)}")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
