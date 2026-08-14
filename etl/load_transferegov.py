"""ETL das transferencias especiais do Transferegov, recorte PB e anos."""

import argparse
import logging

from .load import get_engine, init_db, upsert_rows
from .models import TransferegovEmpenho, TransferegovPlanoAcao
from .transferegov import paginated
from .transform import (
    transform_transferegov_empenho,
    transform_transferegov_plano_acao,
)

logger = logging.getLogger("etl.transferegov")


def parse_years(spec: str) -> list[int]:
    years: set[int] = set()
    for piece in spec.split(","):
        piece = piece.strip()
        if "-" in piece:
            start, end = piece.split("-")
            years.update(range(int(start), int(end) + 1))
        else:
            years.add(int(piece))
    return sorted(years)


def load_planos_acao(engine, uf: str, years: list[int]) -> None:
    year_filter = f"in.({','.join(str(y) for y in years)})"
    rows = [
        transform_transferegov_plano_acao(r)
        for r in paginated("plano_acao_especial", {
            "uf_beneficiario_plano_acao": f"eq.{uf}",
            "ano_emenda_parlamentar_plano_acao": year_filter,
        })
    ]
    logger.info("Planos de acao PB %s: %d", years, len(rows))
    upsert_rows(engine, TransferegovPlanoAcao, rows, ["id_plano_acao"])


def load_empenhos(engine, uf: str, years: list[int]) -> None:
    # filtro por data_emissao entre 1/1/inicio e 1/1/fim+1
    inicio = f"{min(years)}-01-01"
    fim = f"{max(years) + 1}-01-01"
    rows = [
        transform_transferegov_empenho(r)
        for r in paginated("empenho_especial", {
            "uf_beneficiario_empenho": f"eq.{uf}",
            "data_emissao_empenho": f"gte.{inicio}",
            "and": f"(data_emissao_empenho.lt.{fim})",
        })
    ]
    logger.info("Empenhos PB %s..%s: %d", inicio, fim, len(rows))
    upsert_rows(engine, TransferegovEmpenho, rows, ["id_empenho"])


def main() -> None:
    parser = argparse.ArgumentParser(
        description="ETL de Transferencias Especiais (Transferegov) para PB"
    )
    parser.add_argument("--years", default="2024-2026")
    parser.add_argument("--uf", default="PB")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    engine = get_engine()
    init_db(engine)

    years = parse_years(args.years)
    load_planos_acao(engine, args.uf, years)
    load_empenhos(engine, args.uf, years)


if __name__ == "__main__":
    main()
