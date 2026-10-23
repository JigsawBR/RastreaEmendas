import type { StateDocument, StateExecution, StateImport, StateListing } from "./state-amendment.js";
import { describeDestinations } from "./state-destination.js";
import type { StateDestination } from "./state-destination.js";

const text = (row: Record<string, unknown>, key: string) =>
  row[key] == null || String(row[key]).trim() === "" ? null : String(row[key]).trim();
const numeric = (row: Record<string, unknown>, key: string) => {
  const value = row[key];
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const unique = (values: (string | null | undefined)[]) => [...new Set(values.filter((v): v is string => Boolean(v?.trim())))];

function destinationStep(listing: StateListing, destinations: StateDestination[]) {
  const described = describeDestinations(destinations);
  const municipal = described.filter(d => d.municipioBeneficiado);
  const others = described.filter(d => !d.municipioBeneficiado);
  const lacuna = municipal.length
    ? others.length ? "Parte do empenho vai a entidades ou é aplicada pelo Estado; o endereço desses credores é sede, não município beneficiado." : null
    : listing.beneficiario_final ? null
    : others.length ? "Empenho sem transferência a município: o endereço do credor é sede, não município beneficiado. O objeto é exibido sem inferir município."
    : "Beneficiário final não preenchido. O objeto é exibido sem inferir município ou entidade.";
  return {
    evidencias: unique([listing.beneficiario_final,
      ...municipal.map(d => `Transferência ao município de ${d.municipioBeneficiado} (credor: ${d.credor ?? "não informado"})`),
      listing.objeto]),
    lacuna,
  };
}

function mapDocuments(documents: StateDocument[]) {
  return documents.map((document) => {
    const p = document.payload && typeof document.payload === "object" ? document.payload as Record<string, unknown> : {};
    const type = text(p, "descricaoTipo") ?? text(p, "tipoLiquidacao") ?? text(p, "tipoPagamento");
    return {
      id: document.id, fase: document.kind, vinculo: document.link_status,
      fonte: document.source_url, coletadoEm: document.collected_at,
      numero: text(p, "numeroDocumento") ?? text(p, "numeroEmpenho"),
      numeroEmpenho: text(p, "numeroEmpenho"),
      data: text(p, "dataEmpenho") ?? text(p, "dataMovimento") ?? text(p, "dataPagamento"),
      tipo: type, codigoOrgao: text(p, "codigoOrgao"), orgao: text(p, "nomeOrgao"),
      credor: text(p, "nomeCredor"),
      fonteRecurso: text(p, "descricaoFonteRecurso") ?? text(p, "codigoFonteRecurso") ?? text(p, "codigoFonte"),
      funcao: text(p, "nomeFuncao"), municipio: text(p, "nomeMunicipio"),
      historico: text(p, "descricaoEmpenho") ?? text(p, "nomeFinalidade"),
      processo: text(p, "processo"), contrato: text(p, "contrato"), registroCge: text(p, "registroCGE"),
      valor: document.kind === "commitment" ? numeric(p, "valorCalculado")
        : document.kind === "liquidation" ? numeric(p, "valorEmpenhado") : numeric(p, "valorPago"),
      valorAnulado: numeric(p, document.kind === "liquidation" ? "valorAnuladoLD" : "valorAnulado"),
      anulado: /anula|estorno/i.test(type ?? "")
        || (document.kind === "commitment" && (numeric(p, "valorCalculado") ?? 0) < 0)
        || (document.kind === "liquidation" && (numeric(p, "valorEmpenhado") ?? 0) < 0),
    };
  });
}

function criteriaFor(rows: StateExecution[], mapped: ReturnType<typeof mapDocuments>) {
  const confirmed = mapped.filter(d => d.vinculo === "confirmed");
  const positive = confirmed.filter(d => !d.anulado && d.valor !== null && d.valor > (d.valorAnulado ?? 0));
  const organs = unique([...rows.map(r => r.nome_orgao), ...confirmed.map(d => d.orgao)]);
  const criteria = [
    { codigo: "commitment", rotulo: "Documento de empenho", presente: positive.some(d => d.fase === "commitment") },
    { codigo: "liquidation", rotulo: "Documento de liquidação", presente: positive.some(d => d.fase === "liquidation") },
    { codigo: "payment", rotulo: "Documento de pagamento", presente: positive.some(d => d.fase === "payment") },
    { codigo: "function", rotulo: "Função identificada", presente: confirmed.some(d => Boolean(d.funcao)) || rows.some(r => Boolean(r.funcao)) },
    { codigo: "organization", rotulo: "Órgão executor identificado", presente: organs.length > 0 },
  ];
  return { confirmed, positive, organs, criteria };
}

/** RF-08 summary for listings; same criteria as the detail. Not assessable without imported documents. */
export function stateTraceability(rows: StateExecution[], documents: StateDocument[] = [], imports: StateImport[] = []) {
  const { criteria } = criteriaFor(rows, mapDocuments(documents));
  return { atendidos: imports.length ? criteria.filter(c => c.presente).length : null, total: criteria.length };
}

export function buildStateTrail(listing: StateListing, rows: StateExecution[], documents: StateDocument[] = [], imports: StateImport[] = [], destinations: StateDestination[] = []) {
  const mapped = mapDocuments(documents);
  const { confirmed, positive, organs, criteria } = criteriaFor(rows, mapped);
  const sources = unique([...rows.map(r => r.fonte_recurso), ...confirmed.map(d => d.fonteRecurso)]);
  const scopes = ["commitment", "liquidation", "payment"].map(kind => ({
    fase: kind, meses: [...new Set(imports.filter(i => i.kind === kind).map(i => i.month))].sort((a, b) => a - b),
  }));
  const complete = scopes.every(s => s.meses.length === 12);
  const available = imports.length > 0;
  const present = criteria.filter(c => c.presente).length;
  const sourceUrl = (endpoint: string) => `https://api.dados.pb.gov.br/api/v1/${endpoint}?ano=${listing.ano}`;
  return {
    documentos: mapped,
    coberturaDocumental: { completa: complete, periodos: scopes,
      ultimaColeta: imports.length ? new Date(Math.max(...imports.map(i => new Date(i.collected_at).getTime()))) : null,
      motivo: available ? "A cobertura se refere aos meses consultados; vínculos candidatos não comprovam uma etapa." : "Documentos ainda não importados. Ausência na base não comprova ausência de execução.",
    },
    trajeto: [
      { codigo: "source", titulo: "De onde vem o dinheiro", evidencias: sources,
        lacuna: sources.length ? "A fonte e a classificação orçamentária não identificam, sozinhas, toda a origem da arrecadação." : "Fonte de recursos não localizada na base consultada.", fonte: sourceUrl("orcamento/execucao_emendas") },
      { codigo: "author", titulo: "Quem destinou", evidencias: unique([listing.nome_deputado]), lacuna: listing.nome_deputado ? null : "Autor não informado.", fonte: sourceUrl("orcamento/listagem_emendas") },
      { codigo: "requester", titulo: "Quem solicitou", evidencias: [], lacuna: "Solicitante original não identificado pela fonte. Autoria parlamentar não comprova quem apresentou a demanda.", fonte: null },
      { codigo: "destination", titulo: "Para onde foi destinado", ...destinationStep(listing, destinations), fonte: sourceUrl("orcamento/listagem_emendas") },
      { codigo: "executor", titulo: "Quem executa", evidencias: organs, lacuna: organs.length ? null : "Órgão executor não localizado.", fonte: sourceUrl("orcamento/execucao_emendas") },
      { codigo: "creditor", titulo: "Quem consta como credor", evidencias: unique(confirmed.map(d => d.credor)), lacuna: "Credor da nota não equivale necessariamente ao beneficiário final. A existência da nota não comprova pagamento.", fonte: sourceUrl("despesas/notas_empenho") },
      { codigo: "spending", titulo: "Foi efetivamente desembolsado?", evidencias: positive.filter(d => d.fase === "payment").map(d => `Pagamento ${d.numero} · ${d.data ?? "data não informada"}`), lacuna: "Consulte documentos e valores agregados abaixo. Vínculos candidatos e notas anuladas não comprovam desembolso.", fonte: sourceUrl("despesas/autorizacoes_pagamento") },
      { codigo: "delivery", titulo: "A entrega foi comprovada?", evidencias: [], lacuna: "Pagamento não comprova entrega física. Consulte atestes, medições ou prestação de contas na seção de evidências complementares, quando localizados e revisados.", fonte: null },
    ],
    rastreabilidade: { avaliavel: available, score: available ? present * 20 : null,
      completa: available && present === 5, coberturaCompleta: complete, criterios: criteria,
      motivo: "RF-08: 20 pontos por critério documentado (empenho, liquidação, pagamento, função e órgão). Anulações e vínculos candidatos não comprovam fases. O percentual mede evidências encontradas, não entrega física ou regularidade do gasto.",
    },
  };
}
