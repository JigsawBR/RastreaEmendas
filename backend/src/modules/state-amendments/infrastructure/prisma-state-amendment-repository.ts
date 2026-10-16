import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  StateFilters,
  StateAmendmentRepository,
} from "../domain/state-amendment.js";
export function createPrismaStateAmendmentRepository(
  database: Pick<PrismaClient, "emenda_estadual" | "emenda_estadual_execucao" | "state_expense_document" | "state_expense_import">,
): StateAmendmentRepository {
  function stateExecutionFilter(
    filters: StateFilters,
  ): Prisma.emenda_estadual_execucaoWhereInput {
    return {
      ...(filters.ano ? { ano: filters.ano } : {}),
      ...(filters.funcao
        ? { funcao: { contains: filters.funcao, mode: "insensitive" } }
        : {}),
      ...(filters.orgao
        ? {
            OR: [
              { nome_orgao: { contains: filters.orgao, mode: "insensitive" } },
              { codigo_orgao: { equals: filters.orgao } },
            ],
          }
        : {}),
    };
  }
  async function listingFilter(
    filters: StateFilters,
  ): Promise<Prisma.emenda_estadualWhereInput> {
    const where: Prisma.emenda_estadualWhereInput = {
      ...(filters.ano ? { ano: filters.ano } : {}),
      ...(filters.parlamentar
        ? {
            nome_deputado: {
              contains: filters.parlamentar,
              mode: "insensitive",
            },
          }
        : {}),
      ...(filters.beneficiario
        ? {
            beneficiario_final: {
              contains: filters.beneficiario,
              mode: "insensitive",
            },
          }
        : {}),
    };
    if (filters.funcao || filters.orgao) {
      const identities = await database.emenda_estadual_execucao.findMany({
        where: stateExecutionFilter(filters),
        distinct: ["ano", "numero_emenda"],
        select: { ano: true, numero_emenda: true },
      });
      // An empty OR must not turn into an unfiltered listing.
      where.OR = identities.length ? identities : [{ id: -1 }];
    }
    return where;
  }
  async function list(
    filters: StateFilters,
    pagination?: { limit: number; offset: number },
  ) {
    const where = await listingFilter(filters);
    const [total, listings] = await Promise.all([
      database.emenda_estadual.count({ where }),
      database.emenda_estadual.findMany({
        where,
        orderBy: [{ ano: "desc" }, { numero_emenda: "asc" }],
        ...(pagination
          ? { take: pagination.limit, skip: pagination.offset }
          : {}),
      }),
    ]);
    const executions = listings.length
      ? await database.emenda_estadual_execucao.findMany({
          where: {
            AND: [
              stateExecutionFilter(filters),
              {
                OR: listings.map((row) => ({
                  ano: row.ano,
                  numero_emenda: row.numero_emenda,
                })),
              },
            ],
          },
          orderBy: [{ nome_orgao: "asc" }, { funcao: "asc" }, { id: "asc" }],
        })
      : [];
    return { total, listings, executions };
  }
  return {
    list,
    async summary(year) {
      const [listings, executions] = await Promise.all([
        database.emenda_estadual.findMany({ where: year ? { ano: year } : {} }),
        database.emenda_estadual_execucao.findMany({
          where: year ? { ano: year } : {},
        }),
      ]);
      return { listings, executions };
    },
    async find(year, number) {
      const listing = await database.emenda_estadual.findUnique({
        where: { ano_numero_emenda: { ano: year, numero_emenda: number } },
      });
      if (!listing) return null;
      const executions = await database.emenda_estadual_execucao.findMany({
        where: { ano: year, numero_emenda: number },
        orderBy: [{ nome_orgao: "asc" }, { funcao: "asc" }, { id: "asc" }],
      });
      const normalized = /^\s*(\d+)(?:\s*\/\s*(\d{4}))?\s*$/.exec(number);
      const amendmentNumber = normalized && (!normalized[2] || Number(normalized[2]) === year)
        ? String(Number(normalized[1])) : "invalid";
      const [documents, imports] = await Promise.all([
        database.state_expense_document.findMany({
          where: { year, amendment_number: amendmentNumber },
          orderBy: [{ month: "asc" }, { kind: "asc" }, { id: "asc" }],
        }),
        database.state_expense_import.findMany({ where: { year }, orderBy: [{ month: "asc" }, { kind: "asc" }] }),
      ]);
      return { listing, executions, documents, imports };
    },
  };
}
