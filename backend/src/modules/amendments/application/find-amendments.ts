import { prisma } from "../../../shared/infrastructure/database/prisma.js";
import { buildAmendmentQuery } from "../infrastructure/build-amendment-query.js";
import type { AmendmentFilters } from "./amendment-query.js";
export async function findAmendments(
  filters: AmendmentFilters,
  pagination?: { limit: number; offset: number },
) {
  const { amendment: where, allocation } = await buildAmendmentQuery(filters);
  const [total, rows] = await Promise.all([
    prisma.emenda.count({ where }),
    prisma.emenda.findMany({
      where,
      include: { emenda_alocacao: { where: allocation } },
      orderBy: [{ ano: "desc" }, { codigo_emenda: "asc" }],
      ...(pagination
        ? { take: pagination.limit, skip: pagination.offset }
        : {}),
    }),
  ]);
  return { total, rows };
}
