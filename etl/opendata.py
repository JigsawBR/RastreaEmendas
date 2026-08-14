"""Consumo dos arquivos abertos anuais do Portal da Transparencia (CGU)."""

import logging
import zipfile
from io import TextIOWrapper
from pathlib import Path

import pandas as pd
import requests

from . import config

logger = logging.getLogger(__name__)

OPENDATA_BASE = "https://portaldatransparencia.gov.br/download-de-dados"
UA = {"User-Agent": "RastreaEmendas/1.0 (TCC IFPB)"}
OPENZIP_DIR = config.RAW_DATA_DIR / "openzip"


def download_emendas_zip() -> Path:
    """Baixa o arquivo aberto de Emendas Parlamentares.

    O endpoint ignora o {ano} da URL e sempre devolve o mesmo arquivo
    historico (todos os anos), entao baixamos uma unica vez.
    """
    OPENZIP_DIR.mkdir(parents=True, exist_ok=True)
    local = OPENZIP_DIR / "emendas_parlamentares.zip"
    if local.exists() and local.stat().st_size > 0:
        logger.info("Emendas zip: cached (%d bytes)", local.stat().st_size)
        return local
    # o path da URL exige um ano, mas o payload independe dele
    url = f"{OPENDATA_BASE}/emendas-parlamentares/2024"
    logger.info("Downloading %s", url)
    with requests.get(url, headers=UA, timeout=180, stream=True) as r:
        r.raise_for_status()
        with local.open("wb") as fh:
            for chunk in r.iter_content(chunk_size=1 << 16):
                fh.write(chunk)
    logger.info("Saved %s (%d bytes)", local, local.stat().st_size)
    return local


def read_por_favorecido(zip_path: Path) -> pd.DataFrame:
    with zipfile.ZipFile(zip_path) as zf:
        with zf.open("EmendasParlamentares_PorFavorecido.csv") as fh:
            wrapped = TextIOWrapper(fh, encoding="latin-1", newline="")
            return pd.read_csv(wrapped, sep=";", dtype=str, keep_default_na=False)


DESPESAS_DIR = config.RAW_DATA_DIR / "despesas"


def download_despesas_zip(year: int, month: int) -> Path:
    DESPESAS_DIR.mkdir(parents=True, exist_ok=True)
    aaaamm = f"{year:04d}{month:02d}"
    local = DESPESAS_DIR / f"despesas_{aaaamm}.zip"
    if local.exists() and local.stat().st_size > 0:
        return local
    url = f"{OPENDATA_BASE}/despesas-execucao/{aaaamm}"
    logger.info("Downloading %s", url)
    with requests.get(url, headers=UA, timeout=180, stream=True) as r:
        r.raise_for_status()
        with local.open("wb") as fh:
            for chunk in r.iter_content(chunk_size=1 << 16):
                fh.write(chunk)
    logger.info("Saved %s (%d bytes)", local, local.stat().st_size)
    return local


def read_despesas(zip_path: Path, uf: str | None = None, only_emenda: bool = True) -> pd.DataFrame:
    """Le o CSV mensal do zip, filtrando ja no chunking para conter memoria."""
    with zipfile.ZipFile(zip_path) as zf:
        csv_name = next(n for n in zf.namelist() if n.endswith("_Despesas.csv"))
        with zf.open(csv_name) as fh:
            wrapped = TextIOWrapper(fh, encoding="latin-1", newline="")
            chunks = []
            for chunk in pd.read_csv(
                wrapped, sep=";", dtype=str, keep_default_na=False,
                chunksize=50_000,
            ):
                if uf:
                    chunk = chunk[chunk["UF"] == uf]
                if only_emenda:
                    chunk = chunk[chunk["Nome Autor Emenda"] != "SEM EMENDA"]
                    chunk = chunk[chunk["Nome Autor Emenda"] != ""]
                if not chunk.empty:
                    chunks.append(chunk)
            if not chunks:
                return pd.DataFrame()
            return pd.concat(chunks, ignore_index=True)
