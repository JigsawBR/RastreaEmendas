type ExecutionDocument = {
  estagio: string | null;
  orgao_executor: string | null;
};

type Allocation = {
  funcao: string | null;
};

export function calculateTraceability(
  documentos: ExecutionDocument[],
  alocacoes: Allocation[],
) {
  const criterios = [
    { nome: "empenho", atendido: documentos.some((item) => item.estagio === "Empenho") },
    { nome: "liquidacao", atendido: documentos.some((item) => item.estagio === "Liquidação") },
    { nome: "pagamento", atendido: documentos.some((item) => item.estagio === "Pagamento") },
    {
      nome: "funcao",
      atendido: alocacoes.some((item) => Boolean(item.funcao?.trim())),
    },
    {
      nome: "orgao_executor",
      atendido: documentos.some((item) => Boolean(item.orgao_executor?.trim())),
    },
  ];
  const atendidos = criterios.filter((criterio) => criterio.atendido).length;

  return {
    score: atendidos / criterios.length,
    atendidos,
    total: criterios.length,
    criterios,
  };
}
