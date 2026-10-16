import type { Prisma } from "@prisma/client";
import type { AmendmentFilters } from "../application/amendment-query.js";
import { executorFilter, pbLocalidadeFilter } from "./amendment-filters.js";
export async function buildAmendmentQuery(filters: AmendmentFilters) {
  const allocation: Prisma.emenda_alocacaoWhereInput = {
    ...pbLocalidadeFilter(),
    ...(filters.municipio
      ? {
          localidade_gasto: {
            contains: filters.municipio,
            mode: "insensitive",
          },
        }
      : {}),
    ...(filters.funcao
      ? { funcao: { contains: filters.funcao, mode: "insensitive" } }
      : {}),
  };
  const amendment: Prisma.emendaWhereInput = {
    ...(await executorFilter(filters.orgao)),
    ...(filters.ano ? { ano: filters.ano } : {}),
    ...(filters.parlamentar
      ? { nome_autor: { contains: filters.parlamentar, mode: "insensitive" } }
      : {}),
    emenda_alocacao: { some: allocation },
  };
  return { amendment, allocation };
}
