import type { Prisma } from "@prisma/client";
import { prisma } from "../../../shared/infrastructure/database/prisma.js";

// Match executor UG codes as well as registered UG/agency names and codes.
export async function executorFilter(orgao?: string): Promise<Prisma.emendaWhereInput> {
  const term = orgao?.trim();
  if (!term) return {};
  const units = await prisma.unidade_gestora.findMany({
    where: { OR: [
      { codigo: term }, { codigo_orgao: term },
      { nome: { contains: term, mode: "insensitive" } },
      { nome_orgao: { contains: term, mode: "insensitive" } },
    ] },
    select: { codigo: true },
  });
  return { documento_despesa: { some: {
    orgao_executor: { in: [...new Set([term, ...units.map((unit) => unit.codigo)])] },
  } } };
}

// Filtro reutilizavel para restringir alocacoes ao estado da PB.
// Localidades vem como "MUNICIPIO - PB" ou "PARAIBA (UF)"; ha tambem
// "Nacional"/"MULTIPLO" que nao sao atribuiveis a UF alguma.
export function pbLocalidadeFilter(): Prisma.emenda_alocacaoWhereInput {
  return {
    OR: [
      { localidade_gasto: { endsWith: " - PB" } },
      { localidade_gasto: "PARAÍBA (UF)" },
    ],
  };
}
