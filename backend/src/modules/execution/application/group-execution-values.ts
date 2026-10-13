type Document = {
  estagio: string | null;
  orgao_executor: string | null;
  valor_empenhado: unknown;
  valor_pago: unknown;
};

export function groupExecutionValues(documents: Document[]) {
  const groups = new Map<string, {
    quantidade: number; empenhado: number | null; pago: number | null;
    empenhosSemValor: number; pagamentosSemValor: number;
  }>();
  for (const document of documents) {
    const key = document.orgao_executor ?? "Sem UG";
    const total = groups.get(key) ?? {
      quantidade: 0, empenhado: null, pago: null,
      empenhosSemValor: 0, pagamentosSemValor: 0,
    };
    total.quantidade += 1;
    if (document.estagio === "Empenho") {
      if (document.valor_empenhado == null) total.empenhosSemValor += 1;
      else total.empenhado = (total.empenhado ?? 0) + Number(document.valor_empenhado);
    }
    if (document.estagio === "Pagamento") {
      if (document.valor_pago == null) total.pagamentosSemValor += 1;
      else total.pago = (total.pago ?? 0) + Number(document.valor_pago);
    }
    groups.set(key, total);
  }
  return groups;
}
