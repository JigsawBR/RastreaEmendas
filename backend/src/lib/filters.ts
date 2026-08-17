import type { Prisma } from "@prisma/client";

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
