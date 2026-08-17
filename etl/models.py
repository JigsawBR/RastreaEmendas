from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# Nota: a tabela `favorecido` NAO tem FK para `emenda` porque suas linhas vem
# do arquivo aberto PorFavorecido e podem referenciar emendas nao classificadas
# como PB pelo criterio de `localidadeDoGasto` (uma emenda "Nacional" pode ter
# um favorecido em municipio da PB).


class Base(DeclarativeBase):
    pass


class Emenda(Base):
    __tablename__ = "emenda"

    codigo_emenda: Mapped[str] = mapped_column(String(20), primary_key=True)
    ano: Mapped[int] = mapped_column(Integer, index=True)
    tipo_emenda: Mapped[str | None] = mapped_column(String(80))
    autor: Mapped[str | None] = mapped_column(String(120))
    nome_autor: Mapped[str | None] = mapped_column(String(120), index=True)
    numero_emenda: Mapped[str | None] = mapped_column(String(10))


class EmendaAlocacao(Base):
    """Grao real do /emendas: uma linha por emenda x funcao x localidade."""

    __tablename__ = "emenda_alocacao"
    __table_args__ = (
        UniqueConstraint(
            "codigo_emenda", "localidade_gasto", "funcao", "subfuncao",
            name="uq_emenda_alocacao_grain",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    codigo_emenda: Mapped[str] = mapped_column(
        ForeignKey("emenda.codigo_emenda"), index=True
    )
    localidade_gasto: Mapped[str] = mapped_column(String(120), default="", index=True)
    funcao: Mapped[str] = mapped_column(String(60), default="", index=True)
    subfuncao: Mapped[str] = mapped_column(String(60), default="")
    valor_empenhado: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    valor_liquidado: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    valor_pago: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    valor_resto_inscrito: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    valor_resto_cancelado: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    valor_resto_pago: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))


class Favorecido(Base):
    """Grao do arquivo aberto PorFavorecido: emenda x mes x CNPJ favorecido."""

    __tablename__ = "favorecido"
    __table_args__ = (
        UniqueConstraint(
            "codigo_emenda", "ano_mes", "codigo_favorecido",
            name="uq_favorecido_grain",
        ),
    )

    id_favorecido: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    codigo_emenda: Mapped[str] = mapped_column(String(20), index=True)
    ano_mes: Mapped[str] = mapped_column(String(6), index=True)  # "AAAAMM"
    codigo_favorecido: Mapped[str] = mapped_column(String(20), index=True)
    nome_favorecido: Mapped[str | None] = mapped_column(String(200))
    natureza_juridica: Mapped[str | None] = mapped_column(String(120))
    tipo_favorecido: Mapped[str | None] = mapped_column(String(60))
    uf_favorecido: Mapped[str | None] = mapped_column(String(2), index=True)
    municipio_favorecido: Mapped[str | None] = mapped_column(String(120), index=True)
    valor_recebido: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))


class TransferegovPlanoAcao(Base):
    """Plano de acao especial (Transferegov). Grao: id_plano_acao.

    Uma "emenda Pix" (transferencia especial) vira um plano de acao por
    beneficiario. Amarra-se ao codigoEmenda da CGU via
    `numero_emenda_parlamentar` (mesmo formato).
    """

    __tablename__ = "transferegov_plano_acao"

    id_plano_acao: Mapped[int] = mapped_column(primary_key=True)
    codigo_plano_acao: Mapped[str | None] = mapped_column(String(60))
    ano_plano_acao: Mapped[int | None] = mapped_column(Integer, index=True)
    situacao_plano_acao: Mapped[str | None] = mapped_column(String(120))
    cnpj_beneficiario: Mapped[str | None] = mapped_column(String(20), index=True)
    nome_beneficiario: Mapped[str | None] = mapped_column(String(200))
    uf_beneficiario: Mapped[str | None] = mapped_column(String(2), index=True)
    nome_parlamentar: Mapped[str | None] = mapped_column(String(120), index=True)
    ano_emenda: Mapped[int | None] = mapped_column(Integer, index=True)
    numero_emenda: Mapped[str | None] = mapped_column(String(20), index=True)
    valor_custeio: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    valor_investimento: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))


class TransferegovEmpenho(Base):
    """Empenho especial (Transferegov). Grao: id_empenho."""

    __tablename__ = "transferegov_empenho"

    id_empenho: Mapped[int] = mapped_column(primary_key=True)
    id_plano_acao: Mapped[int | None] = mapped_column(Integer, index=True)
    numero_empenho: Mapped[str | None] = mapped_column(String(20), index=True)
    data_emissao: Mapped[date | None] = mapped_column(Date, index=True)
    situacao: Mapped[str | None] = mapped_column(String(60))
    ug_emitente: Mapped[str | None] = mapped_column(String(6), index=True)
    descricao_ug_emitente: Mapped[str | None] = mapped_column(String(200))
    cnpj_beneficiario: Mapped[str | None] = mapped_column(String(20), index=True)
    nome_beneficiario: Mapped[str | None] = mapped_column(String(200))
    uf_beneficiario: Mapped[str | None] = mapped_column(String(2), index=True)
    natureza_despesa: Mapped[str | None] = mapped_column(String(20))
    valor_empenho: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))


class EmendaEstadual(Base):
    """Emenda parlamentar estadual (PB). Grao: (ano, numero_emenda).

    Universo distinto das federais: autoria de deputados estaduais,
    executada por secretarias estaduais.
    """

    __tablename__ = "emenda_estadual"
    __table_args__ = (
        UniqueConstraint("ano", "numero_emenda", name="uq_emenda_estadual"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ano: Mapped[int] = mapped_column(Integer, index=True)
    numero_emenda: Mapped[str] = mapped_column(String(20), index=True)
    prioridade: Mapped[int | None] = mapped_column(Integer)
    nome_deputado: Mapped[str | None] = mapped_column(String(120), index=True)
    tipo: Mapped[str | None] = mapped_column(String(30))
    secretaria: Mapped[str | None] = mapped_column(String(200), index=True)
    objeto: Mapped[str | None] = mapped_column(String(1000))
    beneficiario_final: Mapped[str | None] = mapped_column(String(200))
    tipo_entidade: Mapped[str | None] = mapped_column(String(120))
    valor: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    data_envio: Mapped[date | None] = mapped_column(Date)
    parecer_seplag: Mapped[str | None] = mapped_column(String(2000))
    data_parecer_seplag: Mapped[date | None] = mapped_column(Date)
    parecer_secretario_seplag: Mapped[str | None] = mapped_column(String(500))
    data_parecer_secretario_seplag: Mapped[date | None] = mapped_column(Date)
    cronograma_sefaz: Mapped[str | None] = mapped_column(String(2000))
    data_cronograma_sefaz: Mapped[date | None] = mapped_column(Date)
    parecer_secretario_sefaz: Mapped[str | None] = mapped_column(String(500))
    data_parecer_secretario_sefaz: Mapped[date | None] = mapped_column(Date)


class EmendaEstadualExecucao(Base):
    """Execucao orcamentaria das emendas estaduais. Grao aproximado:
    (emenda x orgao x classificacao orcamentaria)."""

    __tablename__ = "emenda_estadual_execucao"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ano: Mapped[int] = mapped_column(Integer, index=True)
    numero_emenda: Mapped[str] = mapped_column(String(20), index=True)
    codigo_orgao: Mapped[str | None] = mapped_column(String(10), index=True)
    nome_orgao: Mapped[str | None] = mapped_column(String(200), index=True)
    nome_autor: Mapped[str | None] = mapped_column(String(120))
    unidade_orcamentaria: Mapped[str | None] = mapped_column(String(200))
    funcao: Mapped[str | None] = mapped_column(String(120), index=True)
    subfuncao: Mapped[str | None] = mapped_column(String(120))
    programa: Mapped[str | None] = mapped_column(String(200))
    acao: Mapped[str | None] = mapped_column(String(200))
    natureza_despesa: Mapped[str | None] = mapped_column(String(120))
    fonte_recurso: Mapped[str | None] = mapped_column(String(120))
    categoria_economica: Mapped[str | None] = mapped_column(String(60))
    grupo_despesa: Mapped[str | None] = mapped_column(String(60))
    modalidade_aplicacao: Mapped[str | None] = mapped_column(String(60))
    elemento_despesa: Mapped[str | None] = mapped_column(String(120))
    valor_emenda: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    valor_empenhado: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    valor_liquidado: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    valor_pago: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))


class DespesaMensal(Base):
    """Agregado mensal de despesa federal, filtrado a PB com autor de emenda.

    Grao aproximado: (mes x UG x unidade orcamentaria x funcao/subfuncao x
    programa x acao x autor emenda x subtitulo x natureza/elemento).
    Fonte: arquivos abertos /despesas-execucao/{aaaamm}.
    """

    __tablename__ = "despesa_mensal"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ano_mes: Mapped[str] = mapped_column(String(7), index=True)  # AAAA/MM

    codigo_orgao_superior: Mapped[str | None] = mapped_column(String(10))
    nome_orgao_superior: Mapped[str | None] = mapped_column(Text, index=True)
    codigo_orgao: Mapped[str | None] = mapped_column(String(10))
    nome_orgao: Mapped[str | None] = mapped_column(Text, index=True)
    codigo_unidade_gestora: Mapped[str | None] = mapped_column(String(10), index=True)
    nome_unidade_gestora: Mapped[str | None] = mapped_column(Text)
    codigo_unidade_orcamentaria: Mapped[str | None] = mapped_column(String(10))
    nome_unidade_orcamentaria: Mapped[str | None] = mapped_column(Text)

    codigo_funcao: Mapped[str | None] = mapped_column(String(10))
    nome_funcao: Mapped[str | None] = mapped_column(String(120), index=True)
    codigo_subfuncao: Mapped[str | None] = mapped_column(String(10))
    nome_subfuncao: Mapped[str | None] = mapped_column(Text)
    codigo_programa: Mapped[str | None] = mapped_column(String(20))
    nome_programa: Mapped[str | None] = mapped_column(Text)
    codigo_acao: Mapped[str | None] = mapped_column(String(20))
    nome_acao: Mapped[str | None] = mapped_column(Text)

    uf: Mapped[str | None] = mapped_column(String(2), index=True)
    municipio: Mapped[str | None] = mapped_column(Text, index=True)
    codigo_subtitulo: Mapped[str | None] = mapped_column(String(20))
    nome_subtitulo: Mapped[str | None] = mapped_column(Text)

    codigo_autor_emenda: Mapped[str | None] = mapped_column(String(20), index=True)
    nome_autor_emenda: Mapped[str | None] = mapped_column(Text, index=True)

    codigo_categoria_economica: Mapped[str | None] = mapped_column(String(10))
    nome_categoria_economica: Mapped[str | None] = mapped_column(Text)
    codigo_grupo_despesa: Mapped[str | None] = mapped_column(String(10))
    nome_grupo_despesa: Mapped[str | None] = mapped_column(Text)
    codigo_elemento_despesa: Mapped[str | None] = mapped_column(String(10))
    nome_elemento_despesa: Mapped[str | None] = mapped_column(Text)
    codigo_modalidade: Mapped[str | None] = mapped_column(String(10))
    nome_modalidade: Mapped[str | None] = mapped_column(Text)

    valor_empenhado: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    valor_liquidado: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    valor_pago: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    valor_restos_inscritos: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    valor_restos_cancelado: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    valor_restos_pagos: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))


class UnidadeGestora(Base):
    """Cadastro de UGs do SIAFI (Tesouro Transparente, atualizacao mensal).

    Resolve o codigo de 6 digitos extraido do codigoDocumento para o nome
    da unidade e do orgao, ja que a API de documentos da CGU nao os fornece.
    """

    __tablename__ = "unidade_gestora"

    codigo: Mapped[str] = mapped_column(String(6), primary_key=True)
    nome: Mapped[str | None] = mapped_column(String(200))
    uf: Mapped[str | None] = mapped_column(String(2), index=True)
    codigo_orgao: Mapped[str | None] = mapped_column(String(10), index=True)
    nome_orgao: Mapped[str | None] = mapped_column(String(200))
    funcao: Mapped[str | None] = mapped_column(String(30))
    ativo: Mapped[str | None] = mapped_column(String(5))


class DocumentoDespesa(Base):
    __tablename__ = "documento_despesa"

    codigo_documento: Mapped[str] = mapped_column(String(30), primary_key=True)
    codigo_emenda: Mapped[str] = mapped_column(
        ForeignKey("emenda.codigo_emenda"), primary_key=True
    )
    data: Mapped[date | None] = mapped_column(Date)
    estagio: Mapped[str | None] = mapped_column(String(20), index=True)
    codigo_documento_resumido: Mapped[str | None] = mapped_column(String(20))
    especie_tipo: Mapped[str | None] = mapped_column(String(60))
    orgao_executor: Mapped[str | None] = mapped_column(String(6), index=True)
    # preenchidos futuramente a partir dos arquivos de dados abertos,
    # pois a API de documentos nao retorna funcao nem valores
    funcao: Mapped[str | None] = mapped_column(String(60))
    valor_empenhado: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    valor_pago: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
