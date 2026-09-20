"""Resolve a natureza juridica e o municipio de quem recebeu cada documento.

O documento de despesa traz o nome e o CNPJ/CPF do favorecido, mas nao diz o
que ele e. Sem isso, "PARAIBA (UF) - R$ 346 mi" fica opaco: nao da para saber
se o dinheiro foi repassado a uma prefeitura, executado pelo proprio Estado ou
gasto na compra de maquinas de um fabricante. A tabela `favorecido`, vinda dos
arquivos abertos da CGU, tem a natureza juridica de cada CNPJ e permite
responder isso.

O join precisa normalizar o codigo: o documento traz CNPJ formatado
("00.913.443/0001-73") e o arquivo aberto traz so digitos. CPFs mascarados
("***.752.004-**") nao tem como casar e ficam sem natureza, o que e correto:
sao pessoas fisicas, nao entes.

Cuidado ao usar `municipio_favorecido`: ele e o municipio do favorecido, nao o
municipio beneficiado. Para uma prefeitura os dois coincidem; para a YANMAR e
o endereco da fabrica, sem relacao nenhuma com onde a maquina foi parar. Foi
por isso que a ideia de ratear o balde "PARAIBA (UF)" entre municipios pelo
endereco do favorecido foi descartada: daria Bayeux R$ 6,7 mi porque uma
concessionaria de caminhoes fica la.

A natureza juridica cobre so os favorecidos presentes nos arquivos abertos, e
orgaos que recebem por empenho direto costumam faltar (a Secretaria de Estado
da Educacao, com R$ 9,2 mi, e o caso maior). Por isso ha um segundo criterio,
por nome, restrito a prefixos que nao admitem duvida. O que sobra e rotulado
como empresa ou entidade privada, que e o que de fato e: fundacoes de apoio e
fornecedores sao pessoas juridicas de direito privado, ainda que executem
politica publica.
"""

import argparse
import logging

from sqlalchemy import text

from .load import get_engine, init_db

logger = logging.getLogger("etl.favorecidos")

RESOLVER_SQL = text("""
    WITH dict AS (
        SELECT regexp_replace(codigo_favorecido, '\\D', '', 'g') AS cod,
               MIN(natureza_juridica) AS natureza,
               MIN(municipio_favorecido) AS municipio
        FROM favorecido
        WHERE natureza_juridica IS NOT NULL AND natureza_juridica <> 'Sem informação'
        GROUP BY 1
    )
    UPDATE documento_despesa d
    SET natureza_favorecido = dict.natureza,
        municipio_favorecido = dict.municipio
    FROM dict
    WHERE dict.cod = regexp_replace(d.codigo_favorecido, '\\D', '', 'g')
      AND (d.natureza_favorecido IS DISTINCT FROM dict.natureza
           OR d.municipio_favorecido IS DISTINCT FROM dict.municipio)
""")

CLASSIFICAR_SQL = text("""
    UPDATE documento_despesa SET destino_recurso = CASE
        WHEN natureza_favorecido ILIKE '%municipal%'
          OR natureza_favorecido ILIKE 'munic%'
          OR nome_favorecido ~* '^(munic[ií]pio|prefeitura|fundo municipal)' THEN 'municipio'
        WHEN natureza_favorecido ILIKE '%estadual%'
          OR natureza_favorecido ILIKE 'estado%'
          OR nome_favorecido ~* '^(secretaria de estado|estado da para[ií]ba)' THEN 'estado'
        WHEN nome_favorecido ~* '^(universidade|instituto) federal' THEN 'federal'
        WHEN codigo_favorecido LIKE '%*%' THEN 'pessoa_fisica'
        WHEN codigo_favorecido IS NOT NULL THEN 'privado'
        ELSE NULL
    END
""")

COBERTURA_SQL = text("""
    SELECT
        COUNT(*) FILTER (WHERE codigo_favorecido IS NOT NULL) AS com_favorecido,
        COUNT(*) FILTER (WHERE natureza_favorecido IS NOT NULL) AS por_natureza,
        COUNT(*) FILTER (WHERE natureza_favorecido IS NULL
                           AND destino_recurso IN ('municipio', 'estado', 'federal')) AS por_nome
    FROM documento_despesa
    WHERE estagio = 'Empenho'
""")

DESTINO_SQL = text("""
    SELECT COALESCE(destino_recurso, 'nao informado'),
           COUNT(*), COALESCE(SUM(valor_documento), 0)
    FROM documento_despesa
    WHERE estagio = 'Empenho'
    GROUP BY 1
    ORDER BY 3 DESC
""")


def resolver(engine) -> int:
    with engine.begin() as conn:
        atualizados = conn.execute(RESOLVER_SQL).rowcount
        conn.execute(CLASSIFICAR_SQL)
    return atualizados


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Resolve natureza juridica e municipio dos favorecidos dos documentos"
    )
    parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    engine = get_engine()
    init_db(engine)
    logger.info("%d documentos atualizados", resolver(engine))

    with engine.connect() as conn:
        com_fav, por_natureza, por_nome = conn.execute(COBERTURA_SQL).one()
        destinos = conn.execute(DESTINO_SQL).fetchall()

    logger.info(
        "Empenhos: %d com favorecido | %d classificados pela natureza juridica | "
        "%d como ente publico apenas pelo nome",
        com_fav, por_natureza, por_nome,
    )
    for destino, documentos, valor in destinos:
        logger.info("  %-14s %5d documentos  R$ %s", destino, documentos, f"{valor:,.2f}")


if __name__ == "__main__":
    main()
