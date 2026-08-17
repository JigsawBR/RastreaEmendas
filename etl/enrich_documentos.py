"""Enriquecimento dos documentos de despesa via /despesas/documentos/{codigo}.

A listagem /emendas/documentos/{codigoEmenda} traz apenas codigo, data e
fase. O endpoint de detalhe devolve observacao (objeto do gasto), programa,
acao, funcao, favorecido e valor — e por isso e consultado documento a
documento aqui. Documentos muito recentes podem responder 200 com corpo
vazio; ficam pendentes e sao retentados na proxima execucao.
"""

import argparse
import logging

from sqlalchemy import text

from .api_client import PortalClient
from .load import get_engine, init_db
from .transform import parse_brl

logger = logging.getLogger("etl.enrich")

# colunas novas em bancos criados antes do enriquecimento
COLUMNS_DDL = [
    "ALTER TABLE documento_despesa ADD COLUMN IF NOT EXISTS observacao TEXT",
    "ALTER TABLE documento_despesa ADD COLUMN IF NOT EXISTS programa TEXT",
    "ALTER TABLE documento_despesa ADD COLUMN IF NOT EXISTS acao TEXT",
    "ALTER TABLE documento_despesa ADD COLUMN IF NOT EXISTS codigo_favorecido VARCHAR(20)",
    "ALTER TABLE documento_despesa ADD COLUMN IF NOT EXISTS nome_favorecido VARCHAR(200)",
    "ALTER TABLE documento_despesa ADD COLUMN IF NOT EXISTS uf_favorecido VARCHAR(2)",
    "ALTER TABLE documento_despesa ADD COLUMN IF NOT EXISTS valor_documento NUMERIC(15, 2)",
]

UPDATE_SQL = text("""
    UPDATE documento_despesa SET
        observacao = :observacao,
        programa = :programa,
        acao = :acao,
        funcao = :funcao,
        codigo_favorecido = :codigo_favorecido,
        nome_favorecido = :nome_favorecido,
        uf_favorecido = :uf_favorecido,
        valor_documento = :valor_documento,
        valor_empenhado = CASE WHEN estagio = 'Empenho' THEN :valor_documento
                               ELSE valor_empenhado END,
        valor_pago = CASE WHEN estagio = 'Pagamento' THEN :valor_documento
                          ELSE valor_pago END
    WHERE codigo_documento = :codigo_documento
""")


def ensure_columns(engine) -> None:
    with engine.begin() as conn:
        for ddl in COLUMNS_DDL:
            conn.exec_driver_sql(ddl)


def fetch_pending(engine, retry_all: bool, limit: int | None) -> list[str]:
    where = "" if retry_all else "WHERE observacao IS NULL"
    sql = (
        "SELECT DISTINCT codigo_documento FROM documento_despesa "
        f"{where} ORDER BY codigo_documento"
    )
    if limit:
        sql += f" LIMIT {int(limit)}"
    with engine.connect() as conn:
        return [r[0] for r in conn.exec_driver_sql(sql)]


def _parse_valor(v) -> object:
    # documentos de Liquidacao vem com valor "-"
    if v is None or not any(ch.isdigit() for ch in str(v)):
        return None
    return parse_brl(v)


def transform_detalhe(codigo: str, raw: dict) -> dict:
    return {
        "codigo_documento": codigo,
        "observacao": raw.get("observacao") or None,
        "programa": raw.get("programa") or None,
        "acao": raw.get("acao") or None,
        "funcao": raw.get("funcao") or None,
        "codigo_favorecido": raw.get("codigoFavorecido") or None,
        "nome_favorecido": (raw.get("nomeFavorecido") or None),
        "uf_favorecido": raw.get("ufFavorecido") or None,
        "valor_documento": _parse_valor(raw.get("valor")),
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Enriquece documento_despesa com o detalhe da despesa (CGU)"
    )
    parser.add_argument("--limit", type=int, help="processa no maximo N documentos")
    parser.add_argument(
        "--retry-all", action="store_true",
        help="reprocessa tambem documentos ja enriquecidos",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    engine = get_engine()
    init_db(engine)
    ensure_columns(engine)

    codigos = fetch_pending(engine, args.retry_all, args.limit)
    logger.info("Documentos a enriquecer: %d", len(codigos))
    if not codigos:
        return

    client = PortalClient()
    ok = vazio = erro = 0
    for i, codigo in enumerate(codigos, start=1):
        try:
            raw = client.get(f"/despesas/documentos/{codigo}")
        except ValueError:
            # 200 com corpo vazio (documento ainda nao detalhado pela CGU)
            vazio += 1
            raw = None
        except Exception as exc:
            erro += 1
            logger.warning("Falha em %s: %s", codigo, exc)
            raw = None

        if raw:
            row = transform_detalhe(codigo, raw)
            with engine.begin() as conn:
                conn.execute(UPDATE_SQL, row)
            ok += 1

        if i % 100 == 0 or i == len(codigos):
            logger.info(
                "%d/%d | enriquecidos %d | vazios %d | erros %d",
                i, len(codigos), ok, vazio, erro,
            )

    logger.info(
        "Concluido: %d enriquecidos, %d sem detalhe disponivel, %d erros",
        ok, vazio, erro,
    )


if __name__ == "__main__":
    main()
