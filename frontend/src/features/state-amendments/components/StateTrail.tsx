import { useState } from "react";
import type { StateAmendmentDetail } from "../api";
import { formatBRL, formatDate } from "../../../shared/lib/format";
import { Badge } from "../../../shared/components/DesignSystem";

const phaseLabels: Record<string, string> = { commitment: "Empenho", liquidation: "Liquidação", payment: "Pagamento" };

export function StateTrail({ amendment }: { amendment: StateAmendmentDetail }) {
  const [phase, setPhase] = useState("all");
  const documents = amendment.documentos ?? [];
  const visible = documents.filter(d => phase === "all" || d.fase === phase);
  return <>
    <section className="panel" aria-labelledby="state-trail-title">
      <h2 id="state-trail-title">Caminho do recurso público</h2>
      <p className="muted">Cada etapa mostra a evidência encontrada na fonte estadual e o que ainda falta comprovar.</p>
      <div className="two-columns">
        {amendment.trajeto?.map(step => <article className="panel" key={step.codigo}>
          <h3>{step.titulo}</h3>
          <Badge warning={!step.evidencias.length}>{step.evidencias.length ? "Informação localizada" : "Evidência não localizada"}</Badge>
          {step.evidencias.map((evidence, i) => <p key={i}>{evidence}</p>)}
          {step.lacuna && <p className="muted small">{step.lacuna}</p>}
          {step.fonte && <a href={step.fonte} target="_blank" rel="noreferrer">Consultar fonte oficial ↗</a>}
        </article>)}
      </div>
    </section>
    <section className="panel" aria-labelledby="state-documents-title">
      <h2 id="state-documents-title">Documentos e movimentações</h2>
      <p>Vínculo direto: número da emenda e exercício. Liquidações exigem também órgão, empenho, credor e fonte compatíveis, com uma única emenda possível.</p>
      <p className="muted small">Pagamentos sem exercício do empenho explícito aparecem como candidatos, pois podem se referir a restos a pagar. Não entram como comprovação no RF-08. Movimentações e anulações são exibidas individualmente; seus valores não são somados aos agregados.</p>
      <label>Filtrar documentos por fase{" "}<select value={phase} onChange={e => setPhase(e.target.value)}>
        <option value="all">Todas as fases</option>
        {Object.entries(phaseLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
      {!visible.length && <p className="notice">Nenhum documento localizado para esta fase na base carregada. Isso não comprova ausência de execução.</p>}
      {visible.map(document => <article className="panel" key={document.id}>
        <h3>{phaseLabels[document.fase] ?? document.fase} · {document.numero ?? "Número não informado"}</h3>
        <Badge warning={document.vinculo !== "confirmed" || document.anulado}>
          {document.vinculo === "confirmed" ? "Vínculo confirmado" : "Vínculo candidato — exercício a verificar"}
        </Badge>
        <p>{document.tipo ?? "Tipo não informado"} · {document.data ? formatDate(document.data) : "Data não informada"}</p>
        <p><strong>Órgão:</strong> {document.orgao ?? document.codigoOrgao ?? "Não informado"}</p>
        <p><strong>Credor:</strong> {document.credor ?? "Não informado"}</p>
        <p><strong>{document.fase === "liquidation" ? "Valor empenhado referente à liquidação:" : "Valor do movimento:"}</strong> {document.valor === null ? "Não informado" : formatBRL(document.valor)}{document.anulado && " · Anulação / estorno"}</p>
        {document.fase === "liquidation" && <p className="muted small">O dicionário oficial identifica este campo como valor empenhado referente à liquidação. Ele não é somado como valor liquidado; o total liquidado vem da execução agregada.</p>}
        {document.valorAnulado !== null && document.valorAnulado !== 0 && <p>Anulado: {formatBRL(document.valorAnulado)}</p>}
        <p><strong>Fonte de recursos:</strong> {document.fonteRecurso ?? "Não informada"}</p>
        {document.historico && <p>{document.historico}</p>}
        <dl>
          <dt>Empenho de referência</dt><dd>{document.numeroEmpenho ?? "Não informado"}</dd>
          <dt>Processo</dt><dd>{document.processo ?? "Não informado"}</dd>
          <dt>Contrato</dt><dd>{document.contrato ?? "Não informado"}</dd>
          <dt>Registro CGE</dt><dd>{document.registroCge ?? "Não informado"}</dd>
        </dl>
        <p className="muted small">Consulta coletada em {formatDate(document.coletadoEm)}. Município informado na nota: {document.municipio ?? "não informado"}; não é automaticamente o local beneficiado.</p>
        <a href={document.fonte} target="_blank" rel="noreferrer">Consultar registro na fonte oficial ↗</a>
      </article>)}
      <h3>Cobertura da coleta documental</h3>
      <p>{amendment.coberturaDocumental?.motivo ?? "Documentos ainda não importados."}</p>
      {amendment.coberturaDocumental?.periodos.map(scope => <p key={scope.fase}>
        {phaseLabels[scope.fase]}: {scope.meses.length ? `meses ${scope.meses.join(", ")} de ${amendment.ano}` : "nenhum mês consultado"}
      </p>)}
      <p className="muted small">Última coleta: {amendment.coberturaDocumental?.ultimaColeta ? formatDate(amendment.coberturaDocumental.ultimaColeta) : "não registrada"}. A cobertura se limita ao exercício consultado; pagamentos em exercícios posteriores podem ficar fora dela.</p>
    </section>
  </>;
}
