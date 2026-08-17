"""ETL do cadastro de Unidades Gestoras do SIAFI (Tesouro Transparente).

Fonte: dataset "Unidades Gestoras Cadastradas no SIAFI" no CKAN do
Tesouro Transparente, atualizado mensalmente. CSV em UTF-8, separador
virgula, campos entre aspas.
"""

import argparse
import csv
import logging
from pathlib import Path

import requests

from . import config
from .load import get_engine, init_db, upsert_rows
from .models import UnidadeGestora

logger = logging.getLogger("etl.ugs")

UGS_URL = (
    "https://www.tesourotransparente.gov.br/ckan/dataset/"
    "54a699f4-55e3-41cc-a900-27c123545472/resource/"
    "7b83145e-6dc5-4ad2-9730-77132188eb2f/download/"
    "siafirelatoriounidadesgestoras.csv"
)
UA = {"User-Agent": "RastreaEmendas/1.0 (TCC IFPB)"}
UGS_DIR = config.RAW_DATA_DIR / "ugs"


def download_ugs_csv(force: bool = False) -> Path:
    UGS_DIR.mkdir(parents=True, exist_ok=True)
    local = UGS_DIR / "siafi_unidades_gestoras.csv"
    if local.exists() and local.stat().st_size > 0 and not force:
        logger.info("UGs csv: cached (%d bytes)", local.stat().st_size)
        return local
    logger.info("Downloading %s", UGS_URL)
    with requests.get(UGS_URL, headers=UA, timeout=180, stream=True) as r:
        r.raise_for_status()
        with local.open("wb") as fh:
            for chunk in r.iter_content(chunk_size=1 << 16):
                fh.write(chunk)
    logger.info("Saved %s (%d bytes)", local, local.stat().st_size)
    return local


def read_ugs(csv_path: Path) -> list[dict]:
    """Le o CSV tolerando linhas malformadas.

    O campo Endereco tem aspas internas sem escape (ex.: RUA "A", 100), que
    estouram o numero de colunas; so usamos ate "Ativo", entao basta truncar
    ou completar cada linha para o tamanho do cabecalho.
    """
    with csv_path.open(encoding="utf-8", newline="") as fh:
        reader = csv.reader(line.replace("\x00", "") for line in fh)
        header = next(reader)
        rows = []
        for rec in reader:
            if not rec:
                continue
            rec = rec[: len(header)] + [""] * max(0, len(header) - len(rec))
            rows.append(dict(zip(header, rec)))
    return rows


def transform_ug(row: dict) -> dict | None:
    codigo = row["UG"].strip()
    uf = row["UF"].strip()
    # linhas com aspas quebradas deslocam os campos; a UF invalida denuncia
    if not (codigo.isdigit() and len(codigo) == 6) or len(uf) > 2:
        return None
    return {
        "codigo": codigo,
        "nome": row["Título"].strip() or None,
        "uf": uf or None,
        "codigo_orgao": row["Código Órgão"].strip() or None,
        "nome_orgao": row["Título Órgão"].strip() or None,
        "funcao": row["Função"].strip() or None,
        "ativo": row["Ativo"].strip() or None,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="ETL do cadastro de UGs do SIAFI (Tesouro Transparente)"
    )
    parser.add_argument("--force-download", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    csv_path = download_ugs_csv(force=args.force_download)
    raw_rows = read_ugs(csv_path)
    logger.info("UGs no arquivo: %d", len(raw_rows))

    transformed = [t for t in (transform_ug(r) for r in raw_rows) if t]
    skipped = len(raw_rows) - len(transformed)
    if skipped:
        logger.warning("%d linhas malformadas descartadas", skipped)
    rows_by_codigo = {r["codigo"]: r for r in transformed}
    rows = list(rows_by_codigo.values())

    engine = get_engine()
    init_db(engine)
    upsert_rows(engine, UnidadeGestora, rows, ["codigo"])
    logger.info("Cadastro de UGs carregado: %d unidades", len(rows))


if __name__ == "__main__":
    main()
