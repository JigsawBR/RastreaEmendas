// Same values the API validates in backend/src/shared/ordering/amendment-order.ts.
export const amendmentOrders = [
  { value: "recentes", label: "Mais recentes" },
  { value: "empenhado", label: "Maior valor empenhado" },
  { value: "pago", label: "Maior valor pago" },
  { value: "execucao", label: "Menor execução (pago ÷ empenhado)" },
  { value: "rastreabilidade", label: "Menor completude (RF-08)" },
] as const;
export type AmendmentOrder = (typeof amendmentOrders)[number]["value"];

export function readOrder(value: string | null): AmendmentOrder {
  return amendmentOrders.some((order) => order.value === value)
    ? (value as AmendmentOrder)
    : "recentes";
}
