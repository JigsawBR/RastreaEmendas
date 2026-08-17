const BASE = "/api";

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return (await r.json()) as T;
}

export type Resumo = {
  ano: number | null;
  totalEmendas: number;
  totalParlamentares: number;
  totalLocalidades: number;
  valorEmpenhado: number;
  valorLiquidado: number;
  valorPago: number;
  valorRestoInscrito: number;
  taxaExecucao: number;
};

export type EmendaListItem = {
  codigoEmenda: string;
  ano: number;
  tipoEmenda: string | null;
  numeroEmenda: string | null;
  nomeAutor: string | null;
  autor: string | null;
  localidades: string[];
  funcoes: string[];
  valorEmpenhado: number;
  valorLiquidado: number;
  valorPago: number;
};

export type EmendasListResponse = {
  total: number;
  limit: number;
  offset: number;
  items: EmendaListItem[];
};

export type EmendaDetail = {
  codigoEmenda: string;
  ano: number;
  tipoEmenda: string | null;
  numeroEmenda: string | null;
  nomeAutor: string | null;
  autor: string | null;
  valorEmpenhado: number;
  valorLiquidado: number;
  valorPago: number;
  valorRestoInscrito: number;
  alocacoes: {
    localidadeGasto: string;
    funcao: string;
    subfuncao: string;
    valorEmpenhado: number;
    valorLiquidado: number;
    valorPago: number;
    valorRestoInscrito: number;
  }[];
};

export type CadeiaResponse = {
  codigoEmenda: string;
  totalDocumentos: number;
  estagios: {
    estagio: string;
    quantidade: number;
    valorTotal: number;
    documentos: {
      codigoDocumento: string;
      codigoDocumentoResumido: string | null;
      data: string | null;
      especieTipo: string | null;
      orgaoExecutor: string | null;
      funcao: string | null;
      valorEmpenhado: number | null;
      valorPago: number | null;
    }[];
  }[];
};

export type DistribuicaoResponse = {
  codigoEmenda: string;
  porFuncao: {
    funcao: string;
    empenhado: number;
    liquidado: number;
    pago: number;
  }[];
  porOrgao: {
    orgaoExecutor: string;
    quantidade: number;
    empenhado: number;
    pago: number;
  }[];
};

export type RastreabilidadeResponse = {
  codigoEmenda: string;
  score: number;
  atendidos: number;
  total: number;
  criterios: { nome: string; atendido: boolean }[];
};

export type MunicipiosResponse = {
  ano: number | null;
  items: {
    localidade: string;
    quantidadeEmendas: number;
    valorEmpenhado: number;
    valorLiquidado: number;
    valorPago: number;
  }[];
};

export const api = {
  resumo: (ano?: number) => get<Resumo>(`/resumo${ano ? `?ano=${ano}` : ""}`),
  emendas: (params: {
    ano?: number; parlamentar?: string; municipio?: string; funcao?: string;
    limit?: number; offset?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params.ano) qs.set("ano", String(params.ano));
    if (params.parlamentar) qs.set("parlamentar", params.parlamentar);
    if (params.municipio) qs.set("municipio", params.municipio);
    if (params.funcao) qs.set("funcao", params.funcao);
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.offset) qs.set("offset", String(params.offset));
    return get<EmendasListResponse>(`/emendas?${qs.toString()}`);
  },
  emenda: (codigo: string) => get<EmendaDetail>(`/emendas/${codigo}`),
  cadeia: (codigo: string) => get<CadeiaResponse>(`/emendas/${codigo}/cadeia`),
  distribuicao: (codigo: string) => get<DistribuicaoResponse>(`/emendas/${codigo}/distribuicao`),
  rastreabilidade: (codigo: string) => get<RastreabilidadeResponse>(`/emendas/${codigo}/rastreabilidade`),
  municipios: (ano?: number) => get<MunicipiosResponse>(`/municipios${ano ? `?ano=${ano}` : ""}`),
  exportEmendasUrl: (params: { ano?: number; parlamentar?: string; municipio?: string; funcao?: string }) => {
    const qs = new URLSearchParams();
    if (params.ano) qs.set("ano", String(params.ano));
    if (params.parlamentar) qs.set("parlamentar", params.parlamentar);
    if (params.municipio) qs.set("municipio", params.municipio);
    if (params.funcao) qs.set("funcao", params.funcao);
    return `${BASE}/export/emendas?${qs.toString()}`;
  },
};
