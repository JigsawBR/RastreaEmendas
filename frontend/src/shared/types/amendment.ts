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

