"""Emendas aplicadas em varias UFs que chegaram a entes da PB.

Depende da tabela `favorecido` (etl.federal.load_favorecidos) e de `emenda`
(etl.federal): uma emenda que ja esta na base da PB nao entra aqui, para nao
ser contada duas vezes. Ver etl.federal.abrangencia para o criterio.
"""

import argparse
import logging
from collections import defaultdict
from decimal import Decimal

from sqlalchemy import delete, insert, text

from etl.federal.abrangencia import emendas_nacionais, esfera
from etl.federal.opendata import download_emendas_zip, read_emendas
from etl.shared.load import get_engine, init_db
from etl.shared.models import EmendaNacional, EmendaNacionalDestino
from etl.shared.years import parse_years
from etl.state.destinations import resolve_municipality

logger = logging.getLogger("etl.nacionais")

FAVORECIDOS_SQL = text("""
    SELECT codigo_emenda, codigo_favorecido, MIN(nome_favorecido), MIN(natureza_juridica),
           MIN(municipio_favorecido), SUM(valor_recebido)
    FROM favorecido
    WHERE uf_favorecido = :uf AND codigo_emenda = ANY(:codigos)
    GROUP BY 1, 2
    HAVING SUM(valor_recebido) > 0
""")


def build_rows(candidatas: dict[str, dict], favorecidos: list[tuple]) -> tuple[list[dict], list[dict]]:
    """Emendas com pelo menos um ente publico da UF entre os favorecidos."""
    destinos: dict[str, list[dict]] = defaultdict(list)
    for codigo, favorecido, nome, natureza, municipio, valor in favorecidos:
        destinos[codigo].append({
            "codigo_emenda": codigo,
            "ano": candidatas[codigo]["ano"],
            "codigo_favorecido": favorecido,
            "nome_favorecido": nome,
            "natureza_juridica": natureza,
            "esfera": esfera(natureza),
            "municipio_favorecido": municipio,
            "codigo_ibge": resolve_municipality(municipio) if municipio else None,
            "valor_recebido": Decimal(valor),
        })
    mantidas = sorted(c for c, rows in destinos.items() if any(r["esfera"] != "privado" for r in rows))
    return [candidatas[c] for c in mantidas], [r for c in mantidas for r in destinos[c]]


def run(engine, uf: str, years: set[int], *, refresh: bool = False) -> None:
    candidatas = emendas_nacionais(read_emendas(download_emendas_zip(refresh=refresh)), years)
    with engine.connect() as conn:
        na_base = {codigo for (codigo,) in conn.execute(text("SELECT codigo_emenda FROM emenda"))}
        candidatas = {c: e for c, e in candidatas.items() if c not in na_base}
        favorecidos = conn.execute(FAVORECIDOS_SQL, {"uf": uf, "codigos": list(candidatas)}).all()
    emendas, destinos = build_rows(candidatas, favorecidos)

    # a lista muda entre cargas (uma emenda pode passar a ter localidade na UF),
    # entao o recorte dos anos e substituido inteiro
    with engine.begin() as conn:
        conn.execute(delete(EmendaNacionalDestino).where(EmendaNacionalDestino.ano.in_(years)))
        conn.execute(delete(EmendaNacional).where(EmendaNacional.ano.in_(years)))
        if emendas:
            conn.execute(insert(EmendaNacional), emendas)
        if destinos:
            conn.execute(insert(EmendaNacionalDestino), destinos)

    for ano in sorted(years):
        do_ano = [d for d in destinos if d["ano"] == ano]
        publico = sum(d["valor_recebido"] for d in do_ano if d["esfera"] != "privado")
        privado = sum(d["valor_recebido"] for d in do_ano if d["esfera"] == "privado")
        logger.info(
            "%d: %d emendas nacionais com entes da %s | recebido por entes publicos R$ %s | por privados R$ %s",
            ano, len({d["codigo_emenda"] for d in do_ano}), uf, f"{publico:,.2f}", f"{privado:,.2f}",
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Emendas nacionais com recurso recebido por entes da UF")
    parser.add_argument("--years", default="2023-2026")
    parser.add_argument("--uf", default="PB")
    parser.add_argument("--refresh", action="store_true", help="baixa de novo o arquivo aberto de emendas")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    engine = get_engine()
    init_db(engine)
    run(engine, args.uf, parse_years(args.years), refresh=args.refresh)


if __name__ == "__main__":
    main()
