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

type Position = [number, number];
export type Shape = { properties: { code: string; name: string }; geometry: { type: "Polygon"; coordinates: Position[][] } | { type: "MultiPolygon"; coordinates: Position[][][] } };
export type Geography = { type: "FeatureCollection"; features: Shape[] };
/** IBGE mesh with official names; share the ["pb-geography"] query key. */
export async function loadGeography(): Promise<Geography> {
  const response = await fetch("/maps/paraiba.geojson");
  if (!response.ok) throw new Error("Malha indisponível");
  const data = await response.json();
  if (data.type !== "FeatureCollection" || data.features?.length !== 223) throw new Error("Malha incompleta");
  return data;
}
