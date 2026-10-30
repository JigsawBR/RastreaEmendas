import { api } from "../../features/federal-amendments/api";
import type { Resumo, EmendaListItem, EmendasListResponse } from "../../features/federal-amendments/api";
import { stateApi } from "../../features/state-amendments/api";
import type {
  StateSummary,
  StateAmendmentItem,
  StateListResponse,
} from "../../features/state-amendments/api";
import type { AmendmentSource } from "./sources";
import { formatLocality } from "./format";
export type AmendmentItem = EmendaListItem | StateAmendmentItem;
export type AmendmentSummary = Resumo | StateSummary;
export type FilterKey =
  "municipio" | "beneficiario" | "parlamentar" | "funcao" | "orgao";
export type SearchFilters = Record<FilterKey | "ano", string>;
export type SearchParams = {
  ano?: number;
  municipio?: string;
  beneficiario?: string;
  parlamentar?: string;
  funcao?: string;
  orgao?: string;
  ordem?: string;
  limit?: number;
  offset?: number;
};
export interface AmendmentSourceStrategy {
  id: AmendmentSource;
  label: string;
  destinationLabel: string;
  /** `municipalities` offers the official IBGE names, required by the source. */
  fields: readonly { key: FilterKey; label: string; placeholder: string; suggestions?: "municipalities" }[];
  params(
    filters: SearchFilters,
    pagination: { limit: number; offset: number },
  ): SearchParams;
  list(params: SearchParams): Promise<EmendasListResponse | StateListResponse>;
  summary(year?: number): Promise<AmendmentSummary>;
  exportUrl(params: SearchParams): string;
  detailUrl(item: AmendmentItem): string;
  destination(item: AmendmentItem): string;
}
const sharedFields = [
  {
    key: "parlamentar",
    label: "Parlamentar",
    placeholder: "Nome do parlamentar",
  },
  { key: "funcao", label: "Função", placeholder: "Ex.: Saúde" },
] as const;
function commonParams(
  filters: SearchFilters,
  pagination: { limit: number; offset: number },
) {
  return {
    ano: filters.ano ? Number(filters.ano) : undefined,
    parlamentar: filters.parlamentar || undefined,
    funcao: filters.funcao || undefined,
    orgao: filters.orgao || undefined,
    ...pagination,
  };
}
const strategies: Record<AmendmentSource, AmendmentSourceStrategy> = {
  federal: {
    id: "federal",
    label: "Federal",
    destinationLabel: "Localidade",
    fields: [
      {
        key: "municipio",
        label: "Município",
        placeholder: "Nome da localidade",
      },
      ...sharedFields,
      {
        key: "orgao",
        label: "Órgão executor",
        placeholder: "Nome ou código da UG",
      },
    ],
    params: (filters, pagination) => ({
      ...commonParams(filters, pagination),
      municipio: filters.municipio || undefined,
    }),
    list: (params) => api.emendas(params),
    summary: (year) => api.resumo(year),
    exportUrl: (params) => api.exportEmendasUrl(params),
    detailUrl: (item) => "/emendas/" + encodeURIComponent(item.codigoEmenda),
    destination: (item) => item.localidades.map(formatLocality).join(", ") || "Não informada",
  },
  estadual: {
    id: "estadual",
    label: "Estadual (CODATA)",
    destinationLabel: "Destino",
    fields: [
      {
        key: "municipio",
        label: "Município beneficiado",
        placeholder: "Nome oficial do município",
        suggestions: "municipalities",
      },
      {
        key: "beneficiario",
        label: "Beneficiário",
        placeholder: "Nome do beneficiário",
      },
      ...sharedFields,
      {
        key: "orgao",
        label: "Órgão executor",
        placeholder: "Nome ou código do órgão",
      },
    ],
    params: (filters, pagination) => ({
      ...commonParams(filters, pagination),
      beneficiario: filters.beneficiario || undefined,
      municipio: filters.municipio || undefined,
    }),
    list: (params) => stateApi.amendments(params),
    summary: (year) => stateApi.summary(year),
    exportUrl: (params) => stateApi.exportUrl(params),
    detailUrl: (item) =>
      "/emendas-estaduais/" +
      item.ano +
      "/" +
      encodeURIComponent(item.numeroEmenda ?? ""),
    // Municipalities come only from transfers to the city itself; otherwise
    // fall back to the beneficiary named in the listing.
    destination: (item) =>
      item.localidades.join(", ") ||
      ("beneficiarioFinal" in item && item.beneficiarioFinal) ||
      "Não informado",
  },
};
export const amendmentSourceOptions = Object.values(strategies);
export function getAmendmentSource(
  source: AmendmentSource,
): AmendmentSourceStrategy {
  return strategies[source];
}
export function isStateSummary(
  summary: AmendmentSummary,
): summary is StateSummary {
  return "valoresAusentes" in summary;
}
