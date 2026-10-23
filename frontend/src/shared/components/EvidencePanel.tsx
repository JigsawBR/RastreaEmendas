import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { get } from "../api/http";
import { Badge, QueryState } from "./DesignSystem";
import { formatBRL, formatDate } from "../lib/format";

interface Evidence {
  id: string; fonte: string; tipo: string; status: string; titulo: string;
  fonteUrl: string | null; coletadoEm: string; regraVinculo: string;
  dados: Record<string, string | number | null>;
}
interface EvidenceResponse {
  evidencias: Evidence[];
  cobertura: { fonte: string; registrosConsultados: number; evidenciasNoExercicio: number; coletadoEm: string; escopo: string }[];
  observacao: string;
}
const kinds: Record<string, string> = {
  beneficiary: "Entidade citada", agreement: "Convênio ou instrumento", contract: "Contrato",
  payment_context: "Contexto de pagamento", action_plan: "Plano de ação", work_plan: "Plano de trabalho",
  management_report: "Relatório de gestão", local_payment: "Despesa local declarada",
  original_request: "Solicitação original", delivery: "Ateste ou medição", accountability: "Prestação de contas", measurement: "Medição registrada",
};
const statuses: Record<string, string> = { confirmed: "Vínculo confirmado", candidate: "Candidato", declared: "Declarado na fonte", reviewed: "Documento revisado" };
const roles: Record<string, string> = { convenente: "Convenente", contratado: "Contratado", entidade_citada: "Entidade citada no objeto", beneficiario_transferencia: "Beneficiário da transferência", recebedor_declarado: "Recebedor declarado", proponente_convenente: "Proponente / convenente", favorecido_movimento: "Favorecido do movimento", demandante_original: "Solicitante original documentado" };
const sources: Record<string, string> = { pb_objects: "CODATA · objeto da emenda", pb_agreements: "CODATA · convênios", pb_contracts: "CODATA · contratos", pb_payment_queue: "CODATA · ordem cronológica", transferegov_specials: "Transferegov · transferências especiais", siconv_candidates: "Transferegov · SICONV (vínculos candidatos)", reviewed_documents: "Documentos públicos revisados" };
function publicUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try { const u = new URL(value); return ["https:", "http:"].includes(u.protocol) && !u.username && !u.password ? u.href : null; } catch { return null; }
}
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function EvidenceCard({ record, showRule }: { record: Evidence; showRule: boolean }) {
  const d = record.dados, documentUrl = publicUrl(d.documentoUrl);
  return <article className="evidence-card">
    <Badge warning={record.status !== "confirmed" && record.status !== "reviewed"}>{statuses[record.status] ?? record.status}</Badge>
    <h3>{record.titulo}</h3>
    {d.nome && <p><strong>{String(d.nome)}</strong>{d.papel && ` · ${roles[String(d.papel)] ?? d.papel}`}</p>}
    {d.cnpj && <p>CNPJ: {d.cnpj}</p>}
    {d.municipio && <p>Município informado: {d.municipio}</p>}
    {d.trecho && <p>{d.trecho}</p>}
    {d.objeto && <p>{d.objeto}</p>}
    {d.situacao && <p>Situação na fonte: {d.situacao}</p>}
    {d.statusPagamento && <p>Situação na fila: {d.statusPagamento}</p>}
    {d.processo && <p>Processo: {d.processo}</p>}
    {d.data && <p>Data informada: {String(d.data)}</p>}
    {[['valorInstrumento', 'Valor global do instrumento'], ['valorMovimento', 'Valor do movimento'], ['valorExecutadoDeclarado', 'Execução declarada no relatório']].map(([key, label]) => d[key] != null && <p key={key}>{label}: {Number.isFinite(Number(d[key])) ? formatBRL(Number(d[key])) : String(d[key])}</p>)}
    {showRule && <p className="small"><strong>Regra de vínculo:</strong> {record.regraVinculo}</p>}
    {showRule && d.observacao && <p className="muted small">{d.observacao}</p>}
    <p className="small">{sources[record.fonte] ?? record.fonte} · Coleta: {formatDate(record.coletadoEm)}</p>
    <div className="evidence-links">
      {record.fonteUrl && <a href={record.fonteUrl} target="_blank" rel="noopener noreferrer">{record.fonteUrl.endsWith(".zip") ? "Baixar fonte (ZIP)" : "Consultar fonte"}</a>}
      {documentUrl && documentUrl !== record.fonteUrl && <a href={documentUrl} target="_blank" rel="noopener noreferrer">Abrir documento ou contrato</a>}
    </div>
  </article>;
}

// Candidates are grouped by source. When every record of a group shares the
// same rule and caveat (the usual case), they are stated once for the group.
function CandidateGroups({ records }: { records: Evidence[] }) {
  const groups = new Map<string, Evidence[]>();
  for (const record of records) groups.set(record.fonte, [...(groups.get(record.fonte) ?? []), record]);
  return <>{[...groups].map(([source, items]) => {
    const shared = items.every(r => r.regraVinculo === items[0].regraVinculo && r.dados.observacao === items[0].dados.observacao);
    return <div key={source}>
      <h3>{sources[source] ?? source} · {plural(items.length, "candidato", "candidatos")}</h3>
      {shared && <div className="evidence-rule small">
        <p><strong>Regra de vínculo:</strong> {items[0].regraVinculo}</p>
        {items[0].dados.observacao && <p className="muted">{items[0].dados.observacao}</p>}
      </div>}
      <div className="evidence-list">{items.map(record => <EvidenceCard key={record.id} record={record} showRule={!shared} />)}</div>
    </div>;
  })}</>;
}

export function EvidencePanel({ origin, year, number }: { origin: "state" | "federal"; year: number; number: string }) {
  const [filter, setFilter] = useState("all");
  const [shown, setShown] = useState(20);
  const query = useQuery({ queryKey: ["evidence", origin, year, number], queryFn: () => get<EvidenceResponse>(`/evidencias/${origin}/${year}/${encodeURIComponent(number)}`) });
  const records = query.data?.evidencias ?? [];
  const visible = records.filter(r => filter === "all" || r.tipo === filter);
  // Confirmed, declared and reviewed links are the evidence; candidates only
  // suggest where to look, so they stay collapsed below.
  const strong = visible.filter(r => r.status !== "candidate");
  const candidates = visible.filter(r => r.status === "candidate");
  return <section className="panel evidence-panel">
    <h2>Evidências complementares</h2>
    <p className="muted">Quem recebe, quais instrumentos estão vinculados e quais documentos descrevem a aplicação do recurso.</p>
    <QueryState loading={query.isLoading} error={query.isError} retry={() => void query.refetch()} />
    {query.data && <>
      <p className="notice">{query.data.observacao}</p>
      {query.data.cobertura.length === 0 && <p>Nenhuma fonte complementar foi carregada para este exercício.</p>}
      {query.data.cobertura.length > 0 && records.length === 0 && <p>Nenhum vínculo foi localizado no escopo consultado. Isso não comprova ausência de execução ou de documentos.</p>}
      {records.length > 0 && <>
        <label>Tipo de evidência <select value={filter} onChange={event => { setFilter(event.target.value); setShown(20); }}>
          <option value="all">Todos os tipos ({records.length})</option>
          {[...new Set(records.map(r => r.tipo))].map(kind => <option key={kind} value={kind}>{kinds[kind] ?? kind}</option>)}
        </select></label>
        <p className="muted small">{plural(visible.length, "evidência exibida", "evidências exibidas")} · {plural(strong.length, "confirmada ou declarada", "confirmadas ou declaradas")} · {plural(candidates.length, "candidata", "candidatas")}</p>
        {strong.length === 0 && candidates.length > 0 && <p>Nenhum vínculo confirmado. Há apenas vínculos candidatos, que indicam onde procurar, mas não comprovam relação com a emenda.</p>}
        <div className="evidence-list">{strong.map(record => <EvidenceCard key={record.id} record={record} showRule />)}</div>
        {candidates.length > 0 && <details className="evidence-candidates">
          <summary>Ver {plural(candidates.length, "vínculo candidato", "vínculos candidatos")} (não confirmados)</summary>
          <p className="muted small">Correspondências encontradas por regra automática e ainda não confirmadas. Não alteram valores nem o RF-08.</p>
          <CandidateGroups records={candidates.slice(0, shown)} />
          {candidates.length > shown && <button className="button secondary" onClick={() => setShown(shown + 20)}>Mostrar mais candidatos ({candidates.length - shown} restantes)</button>}
        </details>}
      </>}
      <details className="extra-details"><summary>Cobertura das fontes consultadas</summary>
        {query.data.cobertura.map(item => <div key={item.fonte}>
          <h3>{sources[item.fonte] ?? item.fonte}</h3>
          <p>{item.escopo}</p><p className="muted small">{item.registrosConsultados} registros no escopo · {item.evidenciasNoExercicio} evidências no exercício · coleta {formatDate(item.coletadoEm)}</p>
        </div>)}
      </details>
    </>}
  </section>;
}
