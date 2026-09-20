"""Enriquecimento dos documentos de despesa via /despesas/documentos/{codigo}.

A listagem /emendas/documentos/{codigoEmenda} traz apenas codigo, data e
fase. O endpoint de detalhe devolve observacao (objeto do gasto), programa,
acao, funcao, favorecido e valor — e por isso e consultado documento a
documento aqui. Documentos muito recentes podem responder 200 com corpo
vazio; ficam pendentes e sao retentados na proxima execucao.
"""

import argparse
import logging
import re
from decimal import Decimal, InvalidOperation

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
    "ALTER TABLE documento_despesa ADD COLUMN IF NOT EXISTS detalhe_atualizado_em TIMESTAMP",
]

# carimba o que ja foi enriquecido antes da coluna de controle existir
BACKFILL_SQL = """
    UPDATE documento_despesa SET detalhe_atualizado_em = NOW()
    WHERE detalhe_atualizado_em IS NULL
      AND (observacao IS NOT NULL OR nome_favorecido IS NOT NULL
           OR valor_documento IS NOT NULL)
"""

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
                          ELSE valor_pago END,
        detalhe_atualizado_em = NOW()
    WHERE codigo_documento = :codigo_documento
""")


def ensure_columns(engine) -> None:
    with engine.begin() as conn:
        for ddl in COLUMNS_DDL:
            conn.exec_driver_sql(ddl)
        conn.exec_driver_sql(BACKFILL_SQL)


def fetch_pending(
    engine, retry_all: bool, limit: int | None, emendas: list[str] | None = None
) -> list[str]:
    filtros = [] if retry_all else ["detalhe_atualizado_em IS NULL"]
    params: dict = {}
    if emendas:
        filtros.append("codigo_emenda = ANY(:emendas)")
        params["emendas"] = emendas
    where = f"WHERE {' AND '.join(filtros)}" if filtros else ""
    sql = (
        "SELECT DISTINCT codigo_documento FROM documento_despesa "
        f"{where} ORDER BY codigo_documento"
    )
    if limit:
        sql += f" LIMIT {int(limit)}"
    with engine.connect() as conn:
        return [r[0] for r in conn.execute(text(sql), params)]


def _parse_valor(codigo: str, v) -> Decimal | None:
    # documentos de Liquidacao vem com valor "-"; outros trazem simbolos e texto
    if v is None:
        return None
    limpo = re.sub(r"[^\d,.-]", "", str(v))
    if not any(ch.isdigit() for ch in limpo):
        return None
    try:
        return parse_brl(limpo)
    except InvalidOperation:
        logger.warning("Valor nao numerico em %s: %r", codigo, v)
        return None


def _maior_amostra(codigo: str, atual: dict | None, nova: dict | None) -> dict | None:
    # a API alterna entre o valor certo e ele dividido por 10.000 (ver CLAUDE.md)
    if not nova:
        return atual
    if atual is None:
        return nova
    v_atual, v_nova = _parse_valor(codigo, atual.get("valor")), _parse_valor(codigo, nova.get("valor"))
    if v_nova is not None and (v_atual is None or v_nova > v_atual):
        return nova
    return atual


def transform_detalhe(codigo: str, raw: dict) -> dict:
    # ufFavorecido pode vir "Sem Informação"; so persiste siglas de 2 letras
    uf = (raw.get("ufFavorecido") or "").strip()
    return {
        "codigo_documento": codigo,
        "observacao": raw.get("observacao") or None,
        "programa": raw.get("programa") or None,
        "acao": raw.get("acao") or None,
        "funcao": raw.get("funcao") or None,
        "codigo_favorecido": raw.get("codigoFavorecido") or None,
        "nome_favorecido": (raw.get("nomeFavorecido") or None),
        "uf_favorecido": uf if len(uf) == 2 else None,
        "valor_documento": _parse_valor(codigo, raw.get("valor")),
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
    parser.add_argument(
        "--samples", type=int, default=1,
        help="consulta cada documento N vezes e fica com o maior valor "
             "(a API corrompe valores de forma intermitente)",
    )
    parser.add_argument(
        "--emendas", help="restringe aos documentos destas emendas (separadas por virgula)",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    engine = get_engine()
    init_db(engine)
    ensure_columns(engine)

    emendas = [c.strip() for c in args.emendas.split(",")] if args.emendas else None
    codigos = fetch_pending(engine, args.retry_all, args.limit, emendas)
    logger.info("Documentos a enriquecer: %d (%d amostras cada)", len(codigos), args.samples)
    if not codigos:
        return

    client = PortalClient()
    ok = vazio = erro = 0
    for i, codigo in enumerate(codigos, start=1):
        raw = None
        falhou = sem_corpo = False
        for _ in range(args.samples):
            try:
                raw = _maior_amostra(codigo, raw, client.get(f"/despesas/documentos/{codigo}"))
            except ValueError:
                # 200 com corpo vazio (documento ainda nao detalhado pela CGU)
                sem_corpo = True
            except Exception as exc:
                falhou = True
                logger.warning("Falha em %s: %s", codigo, exc)

        if raw is None:
            if falhou:
                erro += 1
            elif sem_corpo:
                vazio += 1

        if raw:
            try:
                row = transform_detalhe(codigo, raw)
                with engine.begin() as conn:
                    conn.execute(UPDATE_SQL, row)
                ok += 1
            except Exception as exc:
                # um registro malformado nao pode interromper a carga inteira
                erro += 1
                logger.warning("Falha ao gravar %s: %s", codigo, exc)

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
