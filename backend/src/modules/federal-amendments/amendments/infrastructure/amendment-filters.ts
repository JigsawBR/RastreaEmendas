import type { Prisma } from "@prisma/client";
import { prisma } from "../../../../shared/infrastructure/database/prisma.js";

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

export const PB_STATE_BUCKET = "PARAÍBA (UF)";
// The ETL only stores a "MÚLTIPLO" row when the open data places it entirely in
// PB (several municipalities, none named by the API); see etl.federal.abrangencia.
export const PB_MULTIPLE_BUCKET = "MÚLTIPLO";

// Filtro reutilizavel para restringir alocacoes ao estado da PB.
// Localidades vem como "MUNICIPIO - PB", "PARAIBA (UF)" ou "MÚLTIPLO".
export function pbLocalidadeFilter(): Prisma.emenda_alocacaoWhereInput {
  return {
    OR: [
      { localidade_gasto: { endsWith: " - PB" } },
      { localidade_gasto: PB_STATE_BUCKET },
      { localidade_gasto: PB_MULTIPLE_BUCKET },
    ],
  };
}
