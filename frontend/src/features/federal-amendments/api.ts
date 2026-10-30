import { API_BASE_URL, get } from "../../shared/api/http";
import type { EmendaListItem } from "../../shared/types/amendment";
export type { EmendaListItem } from "../../shared/types/amendment";

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
  porFuncao: FunctionTotal[];
};
/** Summary by budget function; the state source may lack values (null). */
export type FunctionTotal = { funcao: string; empenhado: number | null; pago: number | null };

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
    /** Set only when the locality is a Paraíba municipality ("CITY - PB"). */
    codigoIbge: string | null;
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
      nomeOrgaoExecutor: string | null;
      funcao: string | null;
      observacao: string | null;
      programa: string | null;
      acao: string | null;
      nomeFavorecido: string | null;
      valorDocumento: number | null;
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
    nomeOrgao: string | null;
    quantidade: number;
    empenhado: number | null;
    pago: number | null;
    empenhosSemValor: number;
    pagamentosSemValor: number;
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
    tipo: "municipio" | "estado" | "multiplo";
    quantidadeEmendas: number;
    valorEmpenhado: number;
    valorLiquidado: number;
    valorPago: number;
    autoresDespesa: number;
    despesaEmpenhado: number;
    despesaLiquidado: number;
    despesaPago: number;
    planosTransferegov: number;
    parlamentaresTransferegov: number;
    transferegovValor: number;
  }[];
};

export type DestinoResponse = {
  ano?: number | null;
  codigoEmenda?: string;
  valorTotal: number;
  grupos: {
    destino: string;
    rotulo: string;
    descricao: string;
    documentos: number;
    missingValueCount: number;
    valor: number;
    /** codigoIbge only for favorecidos in Paraíba. */
    favorecidos: { nome: string; municipio: string | null; uf: string | null; codigoIbge: string | null; valor: number }[];
  }[];
};

/** Amendment spanning several states; only what PB recipients received is PB's. */
export type EmendaNacional = {
  codigoEmenda: string;
  ano: number;
  tipoEmenda: string | null;
  nomeAutor: string | null;
  numeroEmenda: string | null;
  localidades: string;
  funcoes: string;
  /** Whole amendment, every state: context only, never a PB figure. */
  valorEmpenhadoTotal: number;
  valorPagoTotal: number;
  recebidoEntes: number;
  recebidoPrivados: number;
  municipios: number;
};

export type EmendasNacionaisResponse = {
  ano: number | null;
  totalEmendas: number;
  recebidoEntes: number;
  recebidoPrivados: number;
  items: EmendaNacional[];
};

export type EmendaNacionalDetail = EmendaNacional & {
  favorecidos: { nome: string; natureza: string | null; esfera: "municipal" | "estadual" | "privado"; municipio: string | null; codigoIbge: string | null; valor: number }[];
};

export const api = {
  nacionais: (ano?: number) => get<EmendasNacionaisResponse>(`/emendas-nacionais${ano ? `?ano=${ano}` : ""}`),
  nacional: (codigo: string) => get<EmendaNacionalDetail>(`/emendas-nacionais/${encodeURIComponent(codigo)}`),
  resumo: (ano?: number) => get<Resumo>(`/resumo${ano ? `?ano=${ano}` : ""}`),
  destino: (ano?: number) => get<DestinoResponse>(`/resumo/destino${ano ? `?ano=${ano}` : ""}`),
  destinoEmenda: (codigo: string) => get<DestinoResponse>(`/emendas/${codigo}/destino`),
  emendas: (params: {
    ano?: number; parlamentar?: string; municipio?: string; funcao?: string; orgao?: string;
    ordem?: string; limit?: number; offset?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params.ano) qs.set("ano", String(params.ano));
    if (params.ordem) qs.set("ordem", params.ordem);
    if (params.parlamentar) qs.set("parlamentar", params.parlamentar);
    if (params.municipio) qs.set("municipio", params.municipio);
    if (params.funcao) qs.set("funcao", params.funcao);
    if (params.orgao) qs.set("orgao", params.orgao);
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.offset) qs.set("offset", String(params.offset));
    return get<EmendasListResponse>(`/emendas?${qs.toString()}`);
  },
  emenda: (codigo: string) => get<EmendaDetail>(`/emendas/${codigo}`),
  cadeia: (codigo: string) => get<CadeiaResponse>(`/emendas/${codigo}/cadeia`),
  distribuicao: (codigo: string) => get<DistribuicaoResponse>(`/emendas/${codigo}/distribuicao`),
  rastreabilidade: (codigo: string) => get<RastreabilidadeResponse>(`/emendas/${codigo}/rastreabilidade`),
  municipios: (ano?: number) => get<MunicipiosResponse>(`/municipios${ano ? `?ano=${ano}` : ""}`),
  exportEmendasUrl: (params: { ano?: number; parlamentar?: string; municipio?: string; funcao?: string; orgao?: string }) => {
    const qs = new URLSearchParams();
    if (params.ano) qs.set("ano", String(params.ano));
    if (params.parlamentar) qs.set("parlamentar", params.parlamentar);
    if (params.municipio) qs.set("municipio", params.municipio);
    if (params.funcao) qs.set("funcao", params.funcao);
    if (params.orgao) qs.set("orgao", params.orgao);
    return `${API_BASE_URL}/export/emendas?${qs.toString()}`;
  },
};
