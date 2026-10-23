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
  /** RF-08 criteria met; null when the documents were not imported (state only). */
  rastreabilidade: { atendidos: number | null; total: number };
};

