// Amendments applied across several states ("Nacional", or "MÚLTIPLO" spanning
// UFs). The amendment's own values cover every state, so the Paraíba share is
// what Paraíba recipients received, and only public entities count as the
// destination: a private recipient's address is its seat, not where the money
// went (see etl.federal.abrangencia).

export type NationalRecipient = {
  codigo_emenda: string;
  codigo_favorecido: string;
  nome_favorecido: string | null;
  natureza_juridica: string | null;
  esfera: string;
  municipio_favorecido: string | null;
  codigo_ibge: string | null;
  valor_recebido: unknown;
};

export type NationalAmendment = {
  codigo_emenda: string;
  ano: number;
  tipo_emenda: string | null;
  nome_autor: string | null;
  numero_emenda: string | null;
  localidades: string;
  funcoes: string;
  valor_empenhado_total: unknown;
  valor_pago_total: unknown;
};

export const isPublicRecipient = (recipient: Pick<NationalRecipient, "esfera">) => recipient.esfera !== "privado";

export function summarizeRecipients(recipients: NationalRecipient[]) {
  let recebidoEntes = 0, recebidoPrivados = 0;
  const municipios = new Set<string>();
  for (const recipient of recipients) {
    const valor = Number(recipient.valor_recebido ?? 0);
    if (isPublicRecipient(recipient)) {
      recebidoEntes += valor;
      if (recipient.esfera === "municipal" && recipient.codigo_ibge) municipios.add(recipient.codigo_ibge);
    } else {
      recebidoPrivados += valor;
    }
  }
  return { recebidoEntes, recebidoPrivados, municipios: municipios.size };
}

export function describeNationalAmendment(amendment: NationalAmendment, recipients: NationalRecipient[]) {
  return {
    codigoEmenda: amendment.codigo_emenda,
    ano: amendment.ano,
    tipoEmenda: amendment.tipo_emenda,
    nomeAutor: amendment.nome_autor,
    numeroEmenda: amendment.numero_emenda,
    localidades: amendment.localidades,
    funcoes: amendment.funcoes,
    valorEmpenhadoTotal: Number(amendment.valor_empenhado_total ?? 0),
    valorPagoTotal: Number(amendment.valor_pago_total ?? 0),
    ...summarizeRecipients(recipients),
  };
}

export function describeRecipients(recipients: NationalRecipient[]) {
  return recipients
    .map((recipient) => ({
      nome: recipient.nome_favorecido ?? recipient.codigo_favorecido,
      natureza: recipient.natureza_juridica,
      esfera: recipient.esfera,
      municipio: recipient.municipio_favorecido,
      codigoIbge: recipient.codigo_ibge,
      valor: Number(recipient.valor_recebido ?? 0),
    }))
    .sort((a, b) => b.valor - a.valor);
}
