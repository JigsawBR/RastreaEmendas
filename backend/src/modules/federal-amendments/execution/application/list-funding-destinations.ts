import { prisma } from "../../../../shared/infrastructure/database/prisma.js";
import { findMunicipalityCode } from "../../../../shared/territory/municipalities.js";

// Rotulos de `documento_despesa.destino_recurso`, classificado no ETL
// (etl/federal/classify_favorecidos.py) a partir da natureza juridica do favorecido.
// A explicacao acompanha o numero na tela porque a diferenca entre repassar a
// uma prefeitura e comprar de um fornecedor e justamente o que a localidade
// "PARAÍBA (UF)" esconde.
const DESTINOS = {
  municipio: {
    rotulo: "Repasse a município",
    descricao: "Empenhos destinados a uma prefeitura ou fundo municipal.",
  },
  estado: {
    rotulo: "Execução pelo Estado",
    descricao: "Empenhos destinados ao governo estadual para execução da despesa.",
  },
  federal: {
    rotulo: "Órgão federal",
    descricao: "Empenhos destinados a uma universidade ou instituto federal.",
  },
  privado: {
    rotulo: "Empresa ou entidade privada",
    descricao:
      "Empenhos destinados a fornecedor, construtora, associação ou fundação. "
      + "O endereço da empresa não indica o município beneficiado.",
  },
  pessoa_fisica: {
    rotulo: "Pessoa física",
    descricao: "O CPF é mascarado na fonte, então o favorecido não é identificável.",
  },
} as const;

const SEM_CLASSIFICACAO = {
  rotulo: "Não informado",
  descricao: "Favorecido ainda não identificado nos dados disponíveis.",
};

type Grupo = {
  destino: string;
  rotulo: string;
  descricao: string;
  documentos: number;
  missingValueCount: number;
  valor: number;
  favorecidos: Favorecido[];
};
// codigoIbge only for PB: a same-named city in another state must not be
// drawn on the Paraíba map.
type Favorecido = { nome: string; municipio: string | null; uf: string | null; codigoIbge: string | null; valor: number };

function rotular(destino: string | null) {
  return DESTINOS[destino as keyof typeof DESTINOS] ?? SEM_CLASSIFICACAO;
}

// Agrupa os empenhos por destino. O empenho e o estagio certo aqui: e nele que
// o favorecido aparece, e liquidacao e pagamento apenas o repetem.
export async function listFundingDestinations(where: { codigo_emenda?: string; ano?: number }) {
  const documentos = await prisma.documento_despesa.findMany({
    where: {
      estagio: "Empenho",
      ...(where.codigo_emenda ? { codigo_emenda: where.codigo_emenda } : {}),
      ...(where.ano ? { emenda: { ano: where.ano } } : {}),
    },
    select: {
      destino_recurso: true,
      nome_favorecido: true,
      municipio_favorecido: true,
      uf_favorecido: true,
      valor_documento: true,
    },
  });

  const grupos = new Map<string, Grupo>();
  const porFavorecido = new Map<string, Map<string, Omit<Favorecido, "nome">>>();

  for (const d of documentos) {
    const chave = d.destino_recurso ?? "nao_informado";
    const grupo = grupos.get(chave) ?? {
      destino: chave,
      ...rotular(d.destino_recurso),
      documentos: 0,
      missingValueCount: 0,
      valor: 0,
      favorecidos: [],
    };
    grupo.documentos += 1;
    if (d.valor_documento == null) grupo.missingValueCount += 1;
    grupo.valor += Number(d.valor_documento ?? 0);
    grupos.set(chave, grupo);
    if (d.valor_documento == null) continue;

    const nome = d.nome_favorecido ?? "Não informado";
    const favs = porFavorecido.get(chave) ?? new Map();
    const uf = d.uf_favorecido?.trim().toUpperCase() || null;
    const fav = favs.get(nome) ?? {
      municipio: d.municipio_favorecido,
      uf,
      codigoIbge: uf === "PB" && d.municipio_favorecido ? findMunicipalityCode(d.municipio_favorecido) ?? null : null,
      valor: 0,
    };
    fav.valor += Number(d.valor_documento ?? 0);
    favs.set(nome, fav);
    porFavorecido.set(chave, favs);
  }

  for (const [chave, grupo] of grupos) {
    grupo.favorecidos = Array.from(porFavorecido.get(chave) ?? [])
      .map(([nome, f]) => ({ nome, ...f }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);
  }

  return Array.from(grupos.values()).sort((a, b) => b.valor - a.valor);
}
