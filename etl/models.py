from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Integer, Numeric, String, UniqueConstraint
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
