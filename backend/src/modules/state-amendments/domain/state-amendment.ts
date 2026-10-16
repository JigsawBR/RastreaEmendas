export type Amount = { toString(): string } | number | null;
export type StateFilters = {
  ano?: number;
  parlamentar?: string;
  beneficiario?: string;
  funcao?: string;
  orgao?: string;
};
export type Pagination = { limit: number; offset: number };
export type StateListing = {
  ano: number;
  numero_emenda: string;
  tipo: string | null;
  nome_deputado: string | null;
  beneficiario_final: string | null;
  secretaria: string | null;
  objeto: string | null;
  valor: Amount;
  data_envio: Date | null;
  tipo_entidade: string | null;
};
export type StateExecution = {
  fonte_recurso?: string | null;
  id: number;
  ano: number;
  numero_emenda: string;
  codigo_orgao: string | null;
  nome_orgao: string | null;
  funcao: string | null;
  subfuncao: string | null;
  unidade_orcamentaria: string | null;
  programa: string | null;
  acao: string | null;
  natureza_despesa: string | null;
  valor_empenhado: Amount;
  valor_liquidado: Amount;
  valor_pago: Amount;
};
export type StateDocument = {
  id: string;
  year: number;
  month: number;
  amendment_number: string;
  kind: string;
  link_status: string;
  source_url: string;
  collected_at: Date;
  payload: unknown;
};
export type StateImport = {
  month: number;
  kind: string;
  source_count: number;
  linked_count: number;
  collected_at: Date;
};
export interface StateAmendmentRepository {
  list(
    filters: StateFilters,
    pagination?: Pagination,
  ): Promise<{
    total: number;
    listings: StateListing[];
    executions: StateExecution[];
  }>;
  summary(
    year?: number,
  ): Promise<{ listings: StateListing[]; executions: StateExecution[] }>;
  find(
    year: number,
    number: string,
  ): Promise<{ listing: StateListing; executions: StateExecution[];
    documents?: StateDocument[]; imports?: StateImport[] } | null>;
}
