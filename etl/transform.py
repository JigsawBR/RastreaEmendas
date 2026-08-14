from datetime import date, datetime
from decimal import Decimal


def parse_brl(value) -> Decimal | None:
    """Parse Brazilian-formatted currency strings like "100.000,00"."""
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return Decimal(str(value))
    return Decimal(value.replace(".", "").replace(",", "."))


def parse_date_br(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%d/%m/%Y").date()
    except ValueError:
        # a API pode devolver "Sem informação" e outros placeholders
        return None


def extract_ug(codigo_documento: str | None) -> str | None:
    # codigoDocumento layout: UG(6) + gestao(5) + ano(4) + tipo(2) + numero(6)
    if not codigo_documento or len(codigo_documento) < 6:
        return None
    return codigo_documento[:6]


def is_localidade_uf(localidade: str | None, uf_sigla: str, uf_nome: str) -> bool:
    if not localidade:
        return False
    return localidade.endswith(f" - {uf_sigla}") or localidade == f"{uf_nome} (UF)"


def transform_emenda(raw: dict) -> dict:
    return {
        "codigo_emenda": raw["codigoEmenda"],
        "ano": int(raw["ano"]),
        "tipo_emenda": raw.get("tipoEmenda"),
        "autor": raw.get("autor"),
        "nome_autor": raw.get("nomeAutor"),
        "numero_emenda": raw.get("numeroEmenda"),
    }


def transform_alocacao(raw: dict) -> dict:
    return {
        "codigo_emenda": raw["codigoEmenda"],
        "localidade_gasto": raw.get("localidadeDoGasto") or "",
        "funcao": raw.get("funcao") or "",
        "subfuncao": raw.get("subfuncao") or "",
        "valor_empenhado": parse_brl(raw.get("valorEmpenhado")),
        "valor_liquidado": parse_brl(raw.get("valorLiquidado")),
        "valor_pago": parse_brl(raw.get("valorPago")),
        "valor_resto_inscrito": parse_brl(raw.get("valorRestoInscrito")),
        "valor_resto_cancelado": parse_brl(raw.get("valorRestoCancelado")),
        "valor_resto_pago": parse_brl(raw.get("valorRestoPago")),
    }


def _int_or_none(v):
    if v is None or v == "":
        return None
    return int(v)


def _decimal_or_none(v):
    if v is None or v == "":
        return None
    return Decimal(str(v))


def _iso_date_or_none(v):
    if not v:
        return None
    return datetime.strptime(v, "%Y-%m-%d").date()


def transform_transferegov_plano_acao(raw: dict) -> dict:
    return {
        "id_plano_acao": raw["id_plano_acao"],
        "codigo_plano_acao": raw.get("codigo_plano_acao"),
        "ano_plano_acao": _int_or_none(raw.get("ano_plano_acao")),
        "situacao_plano_acao": raw.get("situacao_plano_acao"),
        "cnpj_beneficiario": raw.get("cnpj_beneficiario_plano_acao"),
        "nome_beneficiario": raw.get("nome_beneficiario_plano_acao"),
        "uf_beneficiario": raw.get("uf_beneficiario_plano_acao"),
        "nome_parlamentar": raw.get("nome_parlamentar_emenda_plano_acao"),
        "ano_emenda": _int_or_none(raw.get("ano_emenda_parlamentar_plano_acao")),
        "numero_emenda": raw.get("numero_emenda_parlamentar_plano_acao"),
        "valor_custeio": _decimal_or_none(raw.get("valor_custeio_plano_acao")),
        "valor_investimento": _decimal_or_none(raw.get("valor_investimento_plano_acao")),
    }


def transform_transferegov_empenho(raw: dict) -> dict:
    return {
        "id_empenho": raw["id_empenho"],
        "id_plano_acao": _int_or_none(raw.get("id_plano_acao")),
        "numero_empenho": raw.get("numero_empenho"),
        "data_emissao": _iso_date_or_none(raw.get("data_emissao_empenho")),
        "situacao": raw.get("descricao_situacao_empenho"),
        "ug_emitente": str(raw["ug_emitente_empenho"]) if raw.get("ug_emitente_empenho") is not None else None,
        "descricao_ug_emitente": raw.get("descricao_ug_emitente_empenho"),
        "cnpj_beneficiario": raw.get("cnpj_beneficiario_empenho"),
        "nome_beneficiario": raw.get("nome_beneficiario_empenho"),
        "uf_beneficiario": raw.get("uf_beneficiario_empenho"),
        "natureza_despesa": str(raw["natureza_despesa_empenho"]) if raw.get("natureza_despesa_empenho") is not None else None,
        "valor_empenho": _decimal_or_none(raw.get("valor_empenho")),
    }


def transform_emenda_estadual(raw: dict) -> dict:
    return {
        "ano": int(raw["ano"]),
        "numero_emenda": raw.get("emenda"),
        "prioridade": _int_or_none(raw.get("prioridade")),
        "nome_deputado": raw.get("nomeDeputado"),
        "tipo": raw.get("tipo"),
        "secretaria": raw.get("secretaria"),
        "objeto": raw.get("objeto"),
        "beneficiario_final": raw.get("beneficiarioFinal"),
        "tipo_entidade": raw.get("tipoEntidade"),
        "valor": _decimal_or_none(raw.get("valor")),
        "data_envio": _iso_date_or_none(raw.get("dataEnvio")),
        "parecer_seplag": raw.get("parecerSeplag"),
        "data_parecer_seplag": _iso_date_or_none(raw.get("dataParecerSeplag")),
        "parecer_secretario_seplag": raw.get("parecerSecretarioSeplag"),
        "data_parecer_secretario_seplag": _iso_date_or_none(raw.get("dataParecerSecretarioSeplag")),
        "cronograma_sefaz": raw.get("cronogramaSefaz"),
        "data_cronograma_sefaz": _iso_date_or_none(raw.get("dataCronogramaSefaz")),
        "parecer_secretario_sefaz": raw.get("parecerSecretarioSefaz"),
        "data_parecer_secretario_sefaz": _iso_date_or_none(raw.get("dataParecerSecretarioSefaz")),
    }


def transform_emenda_estadual_execucao(raw: dict) -> dict:
    return {
        "ano": int(raw["ano"]),
        "numero_emenda": raw.get("emenda"),
        "codigo_orgao": str(raw["codigoOrgao"]) if raw.get("codigoOrgao") is not None else None,
        "nome_orgao": raw.get("nomeOrgao"),
        "nome_autor": raw.get("nomeAutor"),
        "unidade_orcamentaria": raw.get("unidadeOrcamentaria"),
        "funcao": raw.get("funcao"),
        "subfuncao": raw.get("subfuncao"),
        "programa": raw.get("programa"),
        "acao": raw.get("acao"),
        "natureza_despesa": raw.get("naturezaDespesa"),
        "fonte_recurso": raw.get("fonteRecurso"),
        "categoria_economica": raw.get("categoriaEconomica"),
        "grupo_despesa": raw.get("grupoDespesa"),
        "modalidade_aplicacao": raw.get("modalidadeAplicacao"),
        "elemento_despesa": raw.get("elementoDespesa"),
        "valor_emenda": _decimal_or_none(raw.get("valorEmenda")),
        "valor_empenhado": _decimal_or_none(raw.get("valorEmpenhado")),
        "valor_liquidado": _decimal_or_none(raw.get("valorLiquidado")),
        "valor_pago": _decimal_or_none(raw.get("valorPago")),
    }


def transform_despesa_mensal(row: dict) -> dict:
    def get(*keys):
        for k in keys:
            v = row.get(k)
            if v not in (None, ""):
                return v
        return None

    return {
        "ano_mes": row.get("Ano e mês do lançamento"),
        "codigo_orgao_superior": get("Código Órgão Superior"),
        "nome_orgao_superior": get("Nome Órgão Superior"),
        "codigo_orgao": get("Código Órgão Subordinado"),
        "nome_orgao": get("Nome Órgão Subordinado"),
        "codigo_unidade_gestora": get("Código Unidade Gestora"),
        "nome_unidade_gestora": get("Nome Unidade Gestora"),
        "codigo_unidade_orcamentaria": get("Código Unidade Orçamentária"),
        "nome_unidade_orcamentaria": get("Nome Unidade Orçamentária"),
        "codigo_funcao": get("Código Função"),
        "nome_funcao": get("Nome Função"),
        "codigo_subfuncao": get("Código Subfução", "Código Subfunção"),
        "nome_subfuncao": get("Nome Subfunção"),
        "codigo_programa": get("Código Programa Orçamentário"),
        "nome_programa": get("Nome Programa Orçamentário"),
        "codigo_acao": get("Código Ação"),
        "nome_acao": get("Nome Ação"),
        "uf": get("UF"),
        "municipio": get("Município"),
        "codigo_subtitulo": get("Código Subtítulo"),
        "nome_subtitulo": get("Nome Subtítulo"),
        "codigo_autor_emenda": get("Código Autor Emenda"),
        "nome_autor_emenda": get("Nome Autor Emenda"),
        "codigo_categoria_economica": get("Código Categoria Econômica"),
        "nome_categoria_economica": get("Nome Categoria Econômica"),
        "codigo_grupo_despesa": get("Código Grupo de Despesa"),
        "nome_grupo_despesa": get("Nome Grupo de Despesa"),
        "codigo_elemento_despesa": get("Código Elemento de Despesa"),
        "nome_elemento_despesa": get("Nome Elemento de Despesa"),
        "codigo_modalidade": get("Código Modalidade da Despesa"),
        "nome_modalidade": get("Modalidade da Despesa"),
        "valor_empenhado": parse_brl(get("Valor Empenhado (R$)")),
        "valor_liquidado": parse_brl(get("Valor Liquidado (R$)")),
        "valor_pago": parse_brl(get("Valor Pago (R$)")),
        "valor_restos_inscritos": parse_brl(get("Valor Restos a Pagar Inscritos (R$)")),
        "valor_restos_cancelado": parse_brl(get("Valor Restos a Pagar Cancelado (R$)")),
        "valor_restos_pagos": parse_brl(get("Valor Restos a Pagar Pagos (R$)")),
    }


def transform_favorecido(row: dict) -> dict | None:
    codigo_emenda = (row.get("Código da Emenda") or "").strip()
    ano_mes = (row.get("Ano/Mês") or "").strip()
    codigo_favorecido = (row.get("Código do Favorecido") or "").strip()
    if not (codigo_emenda and ano_mes and codigo_favorecido):
        return None
    if not codigo_emenda.isdigit():
        # "Sem informacao" / "S/I": nao ha como amarrar a uma emenda
        return None
    return {
        "codigo_emenda": codigo_emenda,
        "ano_mes": ano_mes,
        "codigo_favorecido": codigo_favorecido,
        "nome_favorecido": (row.get("Favorecido") or None),
        "natureza_juridica": (row.get("Natureza Jurídica") or None),
        "tipo_favorecido": (row.get("Tipo Favorecido") or None),
        "uf_favorecido": (row.get("UF Favorecido") or None),
        "municipio_favorecido": (row.get("Município Favorecido") or None),
        "valor_recebido": parse_brl(row.get("Valor Recebido")),
    }


def transform_documento(raw: dict, codigo_emenda: str) -> dict:
    codigo_documento = raw.get("codigoDocumento")
    return {
        "codigo_documento": codigo_documento,
        "codigo_emenda": codigo_emenda,
        "data": parse_date_br(raw.get("data")),
        "estagio": raw.get("fase"),
        "codigo_documento_resumido": raw.get("codigoDocumentoResumido"),
        "especie_tipo": raw.get("especieTipo"),
        "orgao_executor": extract_ug(codigo_documento),
    }
