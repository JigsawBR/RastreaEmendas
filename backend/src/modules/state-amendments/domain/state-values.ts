import type { StateExecution } from "./state-amendment.js";

export function stateIdentity(row: {
  ano: number;
  numero_emenda: string;
}): string {
  return JSON.stringify([row.ano, row.numero_emenda]);
}
export function sumStateValues(rows: StateExecution[]) {
  const sum = (field: "valor_empenhado" | "valor_liquidado" | "valor_pago") => {
    const informed = rows.filter((row) => row[field] !== null);
    return {
      value: informed.length
        ? informed.reduce((sum, row) => sum + Number(row[field]), 0)
        : null,
      missing: rows.length - informed.length,
    };
  };
  const committed = sum("valor_empenhado");
  const liquidated = sum("valor_liquidado");
  const paid = sum("valor_pago");
  return {
    valorEmpenhado: committed.value,
    valorLiquidado: liquidated.value,
    valorPago: paid.value,
    valoresAusentes: {
      empenhado: committed.missing,
      liquidado: liquidated.missing,
      pago: paid.missing,
    },
    totalLinhasExecucao: rows.length,
  };
}
export function groupStateValues(
  rows: StateExecution[],
  by: "function" | "organization",
) {
  const groups = new Map<string, StateExecution[]>();
  for (const row of rows) {
    const key =
      by === "function"
        ? row.funcao || "Não informada"
        : JSON.stringify([row.codigo_orgao, row.nome_orgao]);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return Array.from(groups, ([key, group]) => ({
    rotulo:
      by === "function" ? key : (group[0].nome_orgao ?? "Nome não informado"),
    codigoOrgao: by === "organization" ? group[0].codigo_orgao : null,
    ...sumStateValues(group),
  }));
}
