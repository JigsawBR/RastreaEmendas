"""Emendas sem localidade estadual na API: "MÚLTIPLO" e "Nacional".

O /emendas da API so diz "MÚLTIPLO" ou "Nacional", sem UF, e por isso essas
linhas ficavam fora do recorte da Paraiba. O arquivo aberto
EmendasParlamentares.csv traz, para a mesma linha, a UF de aplicacao, o que
separa dois casos bem diferentes:

- "MÚLTIPLO" com UF = PARAÍBA: a emenda e repartida entre varios municipios,
  todos da PB (ex.: custeio da saude da Bancada da Paraiba, transferencias
  especiais de um deputado para varias prefeituras). E uma emenda da PB por
  inteiro e entra no fluxo normal, com documentos, revalidacao e RF-08.
- "Nacional", ou "MÚLTIPLO" com UF = "Múltiplo": a emenda atende varias UFs
  (ex.: emendas de comissao). So uma parte chega a PB, e o valor dessa parte
  nao existe na emenda: sai do que os favorecidos da PB receberam.

"MÚLTIPLO" com outra UF unica pertence a outro estado e fica de fora, mesmo que
algum favorecido tenha sede na PB: e a sede de um fornecedor, nao o destino.
"""

import re
from decimal import Decimal

import pandas as pd

LOCALIDADE = "Localidade de aplicação do recurso"
MULTIPLO = "MÚLTIPLO"
NACIONAL = "Nacional"
VARIAS_UFS = "Múltiplo"


def _keys(df: pd.DataFrame) -> set[tuple[str, str, str]]:
    return set(zip(df["Código da Emenda"], df["Nome Função"], df["Nome Subfunção"]))


def multiplo_na_uf(emendas: pd.DataFrame, uf_nome: str) -> set[tuple[str, str, str]]:
    """(codigo, funcao, subfuncao) das linhas "MÚLTIPLO" aplicadas so na UF.

    O grao da API e emenda x localidade x funcao x subfuncao; a chave casa com
    ele. Uma chave que aparece tambem fora da UF e ambigua e fica de fora.
    """
    multiplo = emendas[emendas[LOCALIDADE] == MULTIPLO]
    return _keys(multiplo[multiplo["UF"] == uf_nome]) - _keys(multiplo[multiplo["UF"] != uf_nome])


def is_multiplo_na_uf(row: dict, keys: set[tuple[str, str, str]]) -> bool:
    if row.get("localidadeDoGasto") != MULTIPLO:
        return False
    return (row.get("codigoEmenda"), row.get("funcao") or "", row.get("subfuncao") or "") in keys


def _brl(value: str) -> Decimal:
    return Decimal(value.replace(".", "").replace(",", ".")) if value else Decimal(0)


def emendas_nacionais(emendas: pd.DataFrame, years: set[int]) -> dict[str, dict]:
    """Identidade e totais (de todas as UFs) das emendas aplicadas em varias UFs."""
    df = emendas[emendas["Ano da Emenda"].isin({str(y) for y in years})]
    varias_ufs = (df[LOCALIDADE] == NACIONAL) | ((df[LOCALIDADE] == MULTIPLO) & (df["UF"] == VARIAS_UFS))
    codigos = set(df.loc[varias_ufs, "Código da Emenda"])
    result: dict[str, dict] = {}
    for codigo, rows in df[df["Código da Emenda"].isin(codigos)].groupby("Código da Emenda"):
        if not codigo.isdigit():
            continue
        first = rows.iloc[0]
        result[codigo] = {
            "codigo_emenda": codigo,
            "ano": int(first["Ano da Emenda"]),
            "tipo_emenda": first["Tipo de Emenda"] or None,
            "nome_autor": first["Nome do Autor da Emenda"] or None,
            "numero_emenda": first["Número da emenda"] or None,
            "localidades": ", ".join(sorted(set(rows[LOCALIDADE])))[:200],
            "funcoes": ", ".join(sorted(set(rows["Nome Função"]) - {""}))[:200],
            "valor_empenhado_total": sum((_brl(v) for v in rows["Valor Empenhado"]), Decimal(0)),
            "valor_pago_total": sum((_brl(v) for v in rows["Valor Pago"]), Decimal(0)),
        }
    return result


def esfera(natureza: str | None) -> str:
    """Mesmo criterio de etl.federal.classify_favorecidos, pela natureza juridica."""
    texto = natureza or ""
    if re.search(r"municipal", texto, re.I) or re.match(r"munic", texto, re.I):
        return "municipal"
    if re.search(r"estadual", texto, re.I) or re.match(r"estado", texto, re.I):
        return "estadual"
    return "privado"
