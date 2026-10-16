import { get } from "../../shared/api/http";

export interface MunicipalityMapItem {
  codigoIbge: string;
  municipio: string;
  federal: { comRecursos: boolean; emendas: number; empenhado: number; pago: number; planos: number; valorPlanos: number; despesaEmpenhado: number; despesaPago: number };
  estadual: { quantidade: number; emendas: { ano: number; numero: string; fontes: string[] }[] };
}
export interface MunicipalityMapResponse {
  ano: number | null;
  items: MunicipalityMapItem[];
  semMunicipio: { alocacoesFederais: number; emendasEstaduais: number };
  coberturaEstadual: { ano: number; coletadoEm: string }[];
  criterio: string;
}
export const municipalityMapData = (year: number) => get<MunicipalityMapResponse>(`/municipios/mapa?ano=${year}`);
