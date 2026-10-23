import { prisma } from "../../../../shared/infrastructure/database/prisma.js";
import { sortAmendments } from "../../../../shared/ordering/amendment-order.js";
import type { AmendmentOrder } from "../../../../shared/ordering/amendment-order.js";
import { calculateTraceability } from "../../traceability/domain/calculate-traceability.js";
import { findAmendments } from "./find-amendments.js";
import type { AmendmentFilters } from "./amendment-query.js";

// RF-08 for many amendments at once. Distinct (stage, executor) pairs and
// functions are enough: the criteria only test presence, exactly as in the
// detail endpoint, so the list and the detail can never disagree.
async function traceabilityByAmendment(codes: string[]) {
  if (!codes.length) return new Map<string, ReturnType<typeof calculateTraceability>>();
  const [documents, allocations] = await Promise.all([
    prisma.documento_despesa.groupBy({
      by: ["codigo_emenda", "estagio", "orgao_executor"],
      where: { codigo_emenda: { in: codes } },
    }),
    prisma.emenda_alocacao.groupBy({
      by: ["codigo_emenda", "funcao"],
      where: { codigo_emenda: { in: codes } },
    }),
  ]);
  return new Map(codes.map((code) => [code, calculateTraceability(
    documents.filter((row) => row.codigo_emenda === code),
    allocations.filter((row) => row.codigo_emenda === code),
  )]));
}

export async function listAmendments(
  filters: AmendmentFilters,
  order: AmendmentOrder,
  pagination: { limit: number; offset: number },
) {
  // Value and completeness orders need every match; the federal base is small
  // (hundreds of amendments), so they are sorted in memory and then paginated.
  const inMemory = order !== "recentes";
  const { total, rows } = await findAmendments(filters, inMemory ? undefined : pagination);
  const traceability = await traceabilityByAmendment(rows.map((row) => row.codigo_emenda));
  const items = rows.map((emenda) => {
    let empenhado = 0;
    let liquidado = 0;
    let pago = 0;
    const localidades = new Set<string>();
    const funcoes = new Set<string>();
    for (const alocacao of emenda.emenda_alocacao) {
      empenhado += Number(alocacao.valor_empenhado ?? 0);
      liquidado += Number(alocacao.valor_liquidado ?? 0);
      pago += Number(alocacao.valor_pago ?? 0);
      if (alocacao.localidade_gasto) localidades.add(alocacao.localidade_gasto);
      if (alocacao.funcao) funcoes.add(alocacao.funcao);
    }
    const trace = traceability.get(emenda.codigo_emenda);
    return {
      codigoEmenda: emenda.codigo_emenda,
      ano: emenda.ano,
      tipoEmenda: emenda.tipo_emenda,
      numeroEmenda: emenda.numero_emenda,
      nomeAutor: emenda.nome_autor,
      autor: emenda.autor,
      localidades: Array.from(localidades),
      funcoes: Array.from(funcoes),
      valorEmpenhado: empenhado,
      valorLiquidado: liquidado,
      valorPago: pago,
      rastreabilidade: { atendidos: trace?.atendidos ?? 0, total: trace?.total ?? 5 },
    };
  });
  const sorted = sortAmendments(items, order);
  return {
    total,
    items: inMemory ? sorted.slice(pagination.offset, pagination.offset + pagination.limit) : sorted,
  };
}
