import { get } from "../../shared/api/http";
import type { EmendaListItem } from "../../shared/types/amendment";
export type StateTotals = {
  valorEmpenhado: number | null;
  valorLiquidado: number | null;
  valorPago: number | null;
  valoresAusentes: { empenhado: number; liquidado: number; pago: number };
  totalLinhasExecucao: number;
};
export type StateSummary = StateTotals & {
  ano: number | null;
  totalEmendas: number;
  totalParlamentares: number;
  totalBeneficiarios: number;
  emendasSemExecucao: number;
  linhasSemListagem: number;
  valorDestinado: number | null;
  taxaExecucao: number | null;
  destinos: {
    emendasComMunicipioBeneficiado: number;
    porDestino: { destino: string; rotulo: string; emendas: number; valorEmpenhadoLiquido: number }[];
  };
};
export type StateDestination = {
  credor: string | null;
  documentoCredor: string | null;
  modalidadeAplicacao: string | null;
  destino: string;
  destinoRotulo: string;
  municipioCredor: string | null;
  municipioBeneficiado: string | null;
  codigoIbge: string | null;
  valorEmpenhadoLiquido: number;
  notas: number;
};
export type StateAmendmentItem = Omit<
  EmendaListItem,
  "valorEmpenhado" | "valorLiquidado" | "valorPago"
> &
  StateTotals & {
    beneficiarioFinal: string | null;
    secretaria: string | null;
    objeto: string | null;
    valorDestinado: number | null;
  };
export type StateListResponse = {
  total: number;
  limit: number;
  offset: number;
  items: StateAmendmentItem[];
};
export type StateAmendmentDetail = StateTotals & {
  ano: number;
  numeroEmenda: string;
  nomeAutor: string | null;
  tipoEmenda: string | null;
  secretaria: string | null;
  objeto: string | null;
  beneficiarioFinal: string | null;
  tipoEntidade: string | null;
  valorDestinado: number | null;
  dataEnvio: string | null;
  porFuncao: StateDistribution[];
  porOrgao: StateDistribution[];
  execucoes: {
    id: number;
    codigoOrgao: string | null;
    nomeOrgao: string | null;
    funcao: string | null;
    subfuncao: string | null;
    unidadeOrcamentaria: string | null;
    programa: string | null;
    acao: string | null;
    naturezaDespesa: string | null;
    valorEmpenhado: number | null;
    valorLiquidado: number | null;
    valorPago: number | null;
  }[];
  municipiosBeneficiados: string[];
  destinos: StateDestination[];
  documentos: StateExpenseDocument[];
  trajeto: { codigo: string; titulo: string; evidencias: string[]; lacuna: string | null; fonte: string | null }[];
  coberturaDocumental: {
    completa: boolean; ultimaColeta: string | null; motivo: string;
    periodos: { fase: string; meses: number[] }[];
  };
  rastreabilidade: { avaliavel: boolean; score: number | null; motivo: string;
    completa: boolean; coberturaCompleta: boolean;
    criterios: { codigo: string; rotulo: string; presente: boolean }[];
  };
};
export type StateExpenseDocument = {
  id: string; fase: string; vinculo: string; fonte: string; coletadoEm: string;
  numero: string | null; numeroEmpenho: string | null; data: string | null;
  tipo: string | null; codigoOrgao: string | null; orgao: string | null;
  credor: string | null; fonteRecurso: string | null; funcao: string | null;
  municipio: string | null; historico: string | null; processo: string | null;
  contrato: string | null; registroCge: string | null; valor: number | null;
  valorAnulado: number | null; anulado: boolean;
};
export type StateDistribution = StateTotals & {
  rotulo: string;
  codigoOrgao: string | null;
};
export type StateFilters = {
  ano?: number;
  parlamentar?: string;
  beneficiario?: string;
  funcao?: string;
  orgao?: string;
  municipio?: string;
  limit?: number;
  offset?: number;
};
function queryString(params: StateFilters): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (value !== undefined && value !== "") query.set(key, String(value));
  return query.toString();
}
export const stateApi = {
  summary: (year?: number) =>
    get<StateSummary>("/estaduais/resumo" + (year ? "?ano=" + year : "")),
  amendments: (params: StateFilters) =>
    get<StateListResponse>("/estaduais/emendas?" + queryString(params)),
  amendment: (year: number, number: string) =>
    get<StateAmendmentDetail>(
      "/estaduais/emendas/" + year + "/" + encodeURIComponent(number),
    ),
  exportUrl: (params: StateFilters) =>
    "/api/estaduais/export/emendas?" +
    queryString({
      ano: params.ano,
      parlamentar: params.parlamentar,
      beneficiario: params.beneficiario,
      funcao: params.funcao,
      orgao: params.orgao,
      municipio: params.municipio,
    }),
};
