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
export function EvidencePanel({ origin, year, number }: { origin: "state" | "federal"; year: number; number: string }) {
  const [filter, setFilter] = useState("all");
  const [shown, setShown] = useState(20);
  const query = useQuery({ queryKey: ["evidence", origin, year, number], queryFn: () => get<EvidenceResponse>(`/evidencias/${origin}/${year}/${encodeURIComponent(number)}`) });
  const records = query.data?.evidencias ?? [];
  const visible = records.filter(r => filter === "all" || r.tipo === filter);
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
        <p className="muted small">{Math.min(shown, visible.length)} evidências exibidas{visible.length > shown && ` de ${visible.length}`}</p>
        <div className="evidence-list">{visible.slice(0, shown).map(record => {
          const d = record.dados, documentUrl = publicUrl(d.documentoUrl);
          return <article className="evidence-card" key={record.id}>
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
            <p className="small"><strong>Regra de vínculo:</strong> {record.regraVinculo}</p>
            {d.observacao && <p className="muted small">{d.observacao}</p>}
            <p className="small">{sources[record.fonte] ?? record.fonte} · Coleta: {formatDate(record.coletadoEm)}</p>
            <div className="evidence-links">
              {record.fonteUrl && <a href={record.fonteUrl} target="_blank" rel="noopener noreferrer">{record.fonteUrl.endsWith(".zip") ? "Baixar fonte (ZIP)" : "Consultar fonte"}</a>}
              {documentUrl && documentUrl !== record.fonteUrl && <a href={documentUrl} target="_blank" rel="noopener noreferrer">Abrir documento ou contrato</a>}
            </div>
          </article>;
        })}</div>
        {visible.length > shown && <button className="button secondary" onClick={() => setShown(shown + 20)}>Mostrar mais evidências</button>}
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
