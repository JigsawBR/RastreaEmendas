"""Validacao cruzada: soma dos empenhos dos documentos x valor_empenhado da emenda.

A API devolve valores corrompidos de forma intermitente (ver CLAUDE.md). A
amostragem em extract.fetch_emenda reduz o risco mas nao o elimina, e ela so
consulta a propria fonte suspeita. Aqui a conferencia usa uma fonte
independente: os documentos de empenho de cada emenda, que vem de outro
endpoint e ja estao no banco.

Quando a soma dos documentos bate exatamente com o valor da emenda vezes
10.000, a assinatura da corrupcao esta confirmada por duas fontes e o valor e
corrigido com --fix. Divergencias de outra natureza sao apenas relatadas: uma
emenda pode ter empenhos de exercicios anteriores ou documentos ainda nao
enriquecidos, e nesses casos a diferenca e legitima.
"""

import argparse
import logging
from decimal import Decimal

from sqlalchemy import text

from .load import get_engine, init_db

logger = logging.getLogger("etl.validate")

CORRUPTION_FACTOR = Decimal(10000)

COMPARACAO_SQL = text("""
    WITH aloc AS (
        SELECT codigo_emenda, SUM(valor_empenhado) AS valor, COUNT(*) AS linhas
        FROM emenda_alocacao GROUP BY codigo_emenda
    ), docs AS (
        SELECT codigo_emenda, SUM(valor_empenhado) AS valor, COUNT(*) AS linhas
        FROM documento_despesa
        WHERE estagio = 'Empenho' AND valor_empenhado IS NOT NULL
        GROUP BY codigo_emenda
    )
    SELECT a.codigo_emenda, a.valor AS aloc_valor, a.linhas AS aloc_linhas,
           d.valor AS docs_valor, d.linhas AS docs_linhas
    FROM aloc a JOIN docs d ON d.codigo_emenda = a.codigo_emenda
    ORDER BY a.codigo_emenda
""")

REGISTRO_SQL = text("""
    INSERT INTO correcao_alocacao
        (codigo_emenda, valor_corrompido, valor_corrigido, empenhos, criado_em)
    VALUES (:codigo_emenda, :valor_corrompido, :valor_corrigido, :empenhos, NOW())
    ON CONFLICT (codigo_emenda) DO UPDATE SET
        valor_corrompido = EXCLUDED.valor_corrompido,
        valor_corrigido = EXCLUDED.valor_corrigido,
        empenhos = EXCLUDED.empenhos,
        criado_em = EXCLUDED.criado_em
""")

APLICAR_SQL = text("""
    UPDATE emenda_alocacao a SET valor_empenhado = c.valor_corrigido
    FROM correcao_alocacao c
    WHERE c.codigo_emenda = a.codigo_emenda
      AND a.valor_empenhado = c.valor_corrompido
""")


def aplicar_correcoes(engine) -> int:
    """Reaplica as correcoes ja confirmadas e devolve quantas linhas mudaram.

    Idempotente: so toca a linha que ainda esta com o valor corrompido, entao
    rodar de novo depois de uma recarga restaura, e rodar duas vezes seguidas
    nao multiplica nada.
    """
    with engine.begin() as conn:
        return conn.execute(APLICAR_SQL).rowcount


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Confere o valor empenhado das emendas contra a soma dos documentos"
    )
    parser.add_argument(
        "--fix", action="store_true",
        help="corrige as emendas cuja divergencia e exatamente o fator 10.000",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    engine = get_engine()
    init_db(engine)
    with engine.connect() as conn:
        linhas = conn.execute(COMPARACAO_SQL).fetchall()

    confere = corrigiveis = outras = 0
    delta = Decimal(0)
    docs_suspeitos: list[str] = []
    registros: list[dict] = []
    for codigo, aloc, aloc_linhas, docs, docs_linhas in linhas:
        if aloc == docs:
            confere += 1
        elif aloc > 0 and docs == aloc * CORRUPTION_FACTOR:
            corrigiveis += 1
            delta += docs - aloc
            logger.warning(
                "Emenda %s subestimada: banco R$ %s x documentos R$ %s (%d empenhos)",
                codigo, f"{aloc:,.2f}", f"{docs:,.2f}", docs_linhas,
            )
            if args.fix:
                if aloc_linhas > 1:
                    logger.warning(
                        "Emenda %s tem %d alocacoes; corrija manualmente para nao "
                        "distribuir errado", codigo, aloc_linhas,
                    )
                    corrigiveis -= 1
                    delta -= docs - aloc
                    continue
                registros.append({
                    "codigo_emenda": codigo,
                    "valor_corrompido": aloc,
                    "valor_corrigido": docs,
                    "empenhos": docs_linhas,
                })
        elif docs > 0 and aloc == docs * CORRUPTION_FACTOR:
            docs_suspeitos.append(codigo)
            logger.warning(
                "Emenda %s: documentos corrompidos (banco R$ %s x documentos R$ %s)",
                codigo, f"{aloc:,.2f}", f"{docs:,.2f}",
            )
        else:
            outras += 1

    if registros:
        with engine.begin() as conn:
            conn.execute(REGISTRO_SQL, registros)
        logger.info("%d linhas corrigidas", aplicar_correcoes(engine))

    logger.info(
        "%d emendas comparadas | %d conferem | %d com assinatura de corrupcao (%s) | "
        "%d com documentos suspeitos | %d divergentes por outros motivos",
        len(linhas), confere, corrigiveis, "corrigidas" if args.fix else "use --fix",
        len(docs_suspeitos), outras,
    )
    if corrigiveis:
        logger.info("Diferenca %s: R$ %s", "recuperada" if args.fix else "a recuperar", f"{delta:,.2f}")
    if docs_suspeitos:
        logger.info(
            "Para reamostrar os documentos suspeitos:\n"
            "  python -m etl.enrich_documentos --retry-all --samples 5 --emendas %s",
            ",".join(docs_suspeitos),
        )


if __name__ == "__main__":
    main()
