from etl.shared.parsing import _int_or_none, _decimal_or_none, _iso_date_or_none


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
