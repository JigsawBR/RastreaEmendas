/** Orders shared by the federal and state listings; "recentes" keeps the database order. */
export const amendmentOrders = ["recentes", "empenhado", "pago", "execucao", "rastreabilidade"] as const;
export type AmendmentOrder = (typeof amendmentOrders)[number];

export const parseAmendmentOrder = (value: unknown): AmendmentOrder =>
  amendmentOrders.includes(value as AmendmentOrder) ? (value as AmendmentOrder) : "recentes";

type Sortable = {
  valorEmpenhado: number | null;
  valorPago: number | null;
  rastreabilidade: { atendidos: number | null };
};

// Missing values always go last, whatever the direction: an amendment without
// execution must not look like the best or the worst one.
function key(item: Sortable, order: AmendmentOrder): number | null {
  switch (order) {
    case "empenhado": return item.valorEmpenhado === null ? null : -item.valorEmpenhado;
    case "pago": return item.valorPago === null ? null : -item.valorPago;
    case "execucao":
      return item.valorEmpenhado && item.valorPago !== null ? item.valorPago / item.valorEmpenhado : null;
    case "rastreabilidade": return item.rastreabilidade.atendidos;
    default: return 0;
  }
}

export function sortAmendments<T extends Sortable>(items: T[], order: AmendmentOrder): T[] {
  if (order === "recentes") return items;
  return items
    .map((item, index) => ({ item, index, value: key(item, order) }))
    .sort((a, b) =>
      a.value === null ? (b.value === null ? a.index - b.index : 1)
        : b.value === null ? -1
        : a.value - b.value || a.index - b.index)
    .map(({ item }) => item);
}
