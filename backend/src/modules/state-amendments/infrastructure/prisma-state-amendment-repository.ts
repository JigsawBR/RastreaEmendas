import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  StateFilters,
  StateAmendmentRepository,
  StateListing,
} from "../domain/state-amendment.js";
import {
  MUNICIPAL_TRANSFER,
  destinationKey,
  normalizedAmendmentNumber,
} from "../domain/state-destination.js";
export function createPrismaStateAmendmentRepository(
  database: Pick<PrismaClient, "emenda_estadual" | "emenda_estadual_execucao" | "state_expense_document" | "state_expense_import" | "state_amendment_destination">,
): StateAmendmentRepository {
  // Listings keep the source spelling ("0799/2024"); destinations and
  // documents use the normalized number of the documentary ETL ("799").
  // Fetched by year and filtered here: a sorted listing needs every match,
  // and an OR with thousands of keys would not scale.
  async function linkedRecords(listings: Pick<StateListing, "ano" | "numero_emenda">[]) {
    const keys = new Set(listings.map((row) => destinationKey(row.ano, row.numero_emenda)));
    const years = [...new Set(listings.map((row) => row.ano))];
    if (!years.length) return { destinations: [], documents: [], imports: [] };
    const [destinations, documents, imports] = await Promise.all([
      database.state_amendment_destination.findMany({ where: { year: { in: years } } }),
      database.state_expense_document.findMany({ where: { year: { in: years } } }),
      database.state_expense_import.findMany({ where: { year: { in: years } } }),
    ]);
    const linked = <T extends { year: number; amendment_number: string }>(rows: T[]) =>
      rows.filter((row) => keys.has(`${row.year}:${row.amendment_number}`));
    return { destinations: linked(destinations), documents: linked(documents), imports };
  }
  async function listingsInMunicipality(code: string, year?: number) {
    const located = await database.state_amendment_destination.findMany({
      where: {
        destination: MUNICIPAL_TRANSFER,
        creditor_municipality_ibge: code,
        ...(year ? { year } : {}),
      },
      distinct: ["year", "amendment_number"],
      select: { year: true, amendment_number: true },
    });
    if (!located.length) return [];
    const keys = new Set(located.map((row) => `${row.year}:${row.amendment_number}`));
    const candidates = await database.emenda_estadual.findMany({
      where: { ano: { in: [...new Set(located.map((row) => row.year))] } },
      select: { id: true, ano: true, numero_emenda: true },
    });
    return candidates
      .filter((row) => keys.has(destinationKey(row.ano, row.numero_emenda)))
      .map((row) => row.id);
  }
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
    const conditions: Prisma.emenda_estadualWhereInput[] = [];
    if (filters.funcao || filters.orgao) {
      const identities = await database.emenda_estadual_execucao.findMany({
        where: stateExecutionFilter(filters),
        distinct: ["ano", "numero_emenda"],
        select: { ano: true, numero_emenda: true },
      });
      // An empty OR must not turn into an unfiltered listing.
      conditions.push({ OR: identities.length ? identities : [{ id: -1 }] });
    }
    if (filters.municipio) {
      const ids = await listingsInMunicipality(filters.municipio, filters.ano);
      conditions.push({ id: { in: ids.length ? ids : [-1] } });
    }
    if (conditions.length) where.AND = conditions;
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
    return { total, listings, executions, ...(await linkedRecords(listings)) };
  }
  return {
    list,
    async summary(year) {
      const [listings, executions, destinations] = await Promise.all([
        database.emenda_estadual.findMany({ where: year ? { ano: year } : {} }),
        database.emenda_estadual_execucao.findMany({
          where: year ? { ano: year } : {},
        }),
        database.state_amendment_destination.findMany({
          where: year ? { year } : {},
        }),
      ]);
      return { listings, executions, destinations };
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
      const amendmentNumber = normalizedAmendmentNumber(year, number) ?? "invalid";
      const [documents, imports, destinations] = await Promise.all([
        database.state_expense_document.findMany({
          where: { year, amendment_number: amendmentNumber },
          orderBy: [{ month: "asc" }, { kind: "asc" }, { id: "asc" }],
        }),
        database.state_expense_import.findMany({ where: { year }, orderBy: [{ month: "asc" }, { kind: "asc" }] }),
        database.state_amendment_destination.findMany({ where: { year, amendment_number: amendmentNumber } }),
      ]);
      return { listing, executions, documents, imports, destinations };
    },
  };
}
