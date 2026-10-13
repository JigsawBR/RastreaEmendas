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
  ): Promise<{ listing: StateListing; executions: StateExecution[] } | null>;
}
