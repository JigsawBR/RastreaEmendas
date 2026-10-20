import { serializeCsv } from "../../../shared/serialization/csv.js";
import type { StateAmendmentService } from "../application/state-amendment-service.js";
type ListResult = Awaited<ReturnType<StateAmendmentService["list"]>>;
export function stateAmendmentsCsv(result: ListResult): string {
  const headers = [
    "origem",
    "fonte",
    "ano",
    "numero_emenda",
    "parlamentar",
    "beneficiario",
    "municipios_beneficiados",
    "secretaria",
    "funcoes",
    "valor_destinado",
    "valor_empenhado",
    "valor_liquidado",
    "valor_pago",
    "linhas_execucao",
    "empenhados_sem_valor",
    "liquidados_sem_valor",
    "pagos_sem_valor",
  ];
  const rows = result.items.map((row) => [
    "estadual",
    "CODATA",
    row.ano,
    row.numeroEmenda,
    row.nomeAutor,
    row.beneficiarioFinal,
    row.localidades.join(", "),
    row.secretaria,
    row.funcoes.join(", "),
    row.valorDestinado,
    row.valorEmpenhado,
    row.valorLiquidado,
    row.valorPago,
    row.totalLinhasExecucao,
    row.valoresAusentes.empenhado,
    row.valoresAusentes.liquidado,
    row.valoresAusentes.pago,
  ]);
  return serializeCsv(headers, rows);
}
