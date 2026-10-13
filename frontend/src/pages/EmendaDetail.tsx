import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "react-router-dom";
import { api } from "../lib/api";
import {
  formatBRL,
  formatBRLCompact,
  formatDate,
  formatPct,
} from "../lib/format";
import {
  Badge,
  Metric,
  PageHeading,
  QueryState,
  ValueBar,
} from "../components/DesignSystem";
import DestinoDoDinheiro from "../components/DestinoDoDinheiro";
const phases = ["Empenho", "Liquidação", "Pagamento"];
const criterionLabels: Record<string, string> = {
  empenho: "Empenho",
  liquidacao: "Liquidação",
  pagamento: "Pagamento",
  funcao: "Função",
  orgao_executor: "Órgão executor",
};
const descriptions = [
  "Compromisso assumido",
  "Despesa verificada",
  "Desembolso registrado",
];
export default function EmendaDetail() {
  const { codigo = "" } = useParams();
  const location = useLocation();
  const returnPath = (location.state as { backTo?: string } | null)?.backTo;
  const backTo = returnPath?.startsWith("/emendas?") ? returnPath : "/emendas";
  const [selected, setSelected] = useState("Pagamento");
  const detail = useQuery({
    queryKey: ["emenda", codigo],
    queryFn: () => api.emenda(codigo),
  });
  const chain = useQuery({
    queryKey: ["cadeia", codigo],
    queryFn: () => api.cadeia(codigo),
  });
  const distribution = useQuery({
    queryKey: ["dist", codigo],
    queryFn: () => api.distribuicao(codigo),
  });
  const trace = useQuery({
    queryKey: ["rastr", codigo],
    queryFn: () => api.rastreabilidade(codigo),
  });
  if (!detail.data)
    return (
      <div className="page-stack">
        <Link to={backTo}>← Voltar à consulta filtrada</Link>
        <QueryState
          loading={detail.isLoading}
          error={detail.isError}
          retry={() => void detail.refetch()}
        />
      </div>
    );
  const e = detail.data;
  const stage = chain.data?.estagios.find((s) => s.estagio === selected);
  return (
    <div className="page-stack">
      <PageHeading
        title={"Emenda " + (e.numeroEmenda ?? e.codigoEmenda)}
        description={
          <>
            {e.nomeAutor ?? "Parlamentar não informado"} /{" "}
            {e.tipoEmenda ?? "Modalidade não informada"} / Exercício {e.ano}
          </>
        }
      />
      <Link to={backTo}>← Voltar à consulta filtrada</Link>
      <div className="metrics">
        <Metric
          label="Empenhado"
          value={formatBRLCompact(e.valorEmpenhado)}
          context="Compromisso registrado"
        />
        <Metric
          label="Liquidado"
          value={formatBRLCompact(e.valorLiquidado)}
          context="Despesa verificada"
        />
        <Metric
          label="Pago"
          value={formatBRLCompact(e.valorPago)}
          context={
            e.valorEmpenhado > 0
              ? formatPct(e.valorPago / e.valorEmpenhado) + " do empenhado"
              : "Relação não calculável: empenhado zero"
          }
        />
        <Metric
          label="Diferença"
          value={formatBRLCompact(e.valorEmpenhado - e.valorPago)}
          context="Empenhado − pago"
        />
      </div>
      <div className="notice">
        A diferença não equivale a saldo disponível ou dívida comprovada.
        Pagamentos podem incluir restos de exercícios anteriores.
        {e.valorPago > e.valorEmpenhado &&
          " O pago supera o empenhado neste recorte."}
      </div>
      <section className="panel">
        <h2>Como o recurso avançou</h2>
        <p className="muted small">
          Documentos associados à emenda, organizados por fase. A presença das
          fases não comprova conciliação individual.
        </p>
        <QueryState
          loading={chain.isLoading}
          error={chain.isError}
          retry={() => void chain.refetch()}
        />
        <div className="phase-grid">
          {phases.map((phase, i) => {
            const s = chain.data?.estagios.find((s) => s.estagio === phase);
            const missing =
              s?.documentos.filter((d) => d.valorDocumento === null).length ??
              0;
            const known =
              s?.documentos.filter((d) => d.valorDocumento !== null) ?? [];
            const total = known.reduce(
              (sum, d) => sum + (d.valorDocumento ?? 0),
              0,
            );
            return (
              <button
                key={phase}
                className="panel phase-card"
                onClick={() => setSelected(phase)}
                aria-pressed={selected === phase}
                aria-controls="phase-documents"
              >
                <Badge warning={!!s && s.quantidade === 0}>
                  {"0" + (i + 1)} / {phase}
                </Badge>
                <strong>
                  {!s
                    ? chain.isError
                      ? "Dados indisponíveis"
                      : "Aguardando dados"
                    : known.length === 0
                      ? "Não informado"
                      : formatBRL(total)}
                </strong>
                <p>{descriptions[i]}</p>
                <small>
                  {s
                    ? s.quantidade + " documentos"
                    : chain.isError
                      ? "Consulta indisponível"
                      : "Consulta em andamento"}
                  {missing > 0 && " · soma parcial"}
                </small>
              </button>
            );
          })}
        </div>
        <div className="documents" id="phase-documents">
          <h3>Documentos de {selected.toLocaleLowerCase("pt-BR")}</h3>
          {stage && stage.quantidade === 0 && (
            <p className="muted small">
              Nenhum documento desta fase foi encontrado na base carregada. Isso
              não comprova que a despesa nunca chegou a esta fase.
            </p>
          )}
          {stage && stage.quantidade > 0 && (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Data</th>
                    <th>Órgão / UG</th>
                    <th>Favorecido</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {stage.documentos.map((d) => (
                    <Fragment key={d.codigoDocumento}>
                      <tr>
                        <td>
                          {d.codigoDocumentoResumido ?? d.codigoDocumento}
                        </td>
                        <td>{d.data ? formatDate(d.data) : "Não informada"}</td>
                        <td>
                          {d.nomeOrgaoExecutor ?? "Nome não informado"}
                          <small>UG {d.orgaoExecutor ?? "não informada"}</small>
                        </td>
                        <td>{d.nomeFavorecido ?? "Não informado"}</td>
                        <td>
                          {d.valorDocumento === null
                            ? "Não informado"
                            : formatBRL(d.valorDocumento)}
                        </td>
                      </tr>
                      {d.observacao && (
                        <tr>
                          <td colSpan={5} className="muted small">
                            {d.observacao}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
      <QueryState
        loading={distribution.isLoading}
        error={distribution.isError}
        retry={() => void distribution.refetch()}
      />
      {distribution.data && (
        <div className="two-columns">
          <section className="panel">
            <h2>Distribuição por função</h2>
            {distribution.data.porFuncao.length === 0 && (
              <p className="muted">
                Nenhuma função encontrada na base carregada.
              </p>
            )}
            {distribution.data.porFuncao.map((f) => (
              <div className="distribution-item" key={f.funcao}>
                <ValueBar
                  label={f.funcao + " · empenhado"}
                  value={f.empenhado}
                  max={Math.max(f.empenhado, f.pago)}
                />
                <ValueBar
                  label={f.funcao + " · pago"}
                  value={f.pago}
                  max={Math.max(f.empenhado, f.pago)}
                />
              </div>
            ))}
            <p className="muted small">
              Fonte do indicador: alocações da emenda.
            </p>
          </section>
          <section className="panel">
            <h2>Distribuição por órgão executor</h2>
            {distribution.data.porOrgao.length === 0 && (
              <p className="muted">
                Nenhum órgão executor encontrado na base carregada.
              </p>
            )}
            {distribution.data.porOrgao.map((o) => (
              <div className="distribution-item" key={o.orgaoExecutor}>
                <h3>
                  {o.nomeOrgao ?? "Nome não informado"} · UG {o.orgaoExecutor}
                </h3>
                <ValueBar
                  label="Empenhado"
                  value={o.empenhado}
                  max={Math.max(o.empenhado ?? 0, o.pago ?? 0)}
                  partial={o.empenhosSemValor > 0}
                />
                <ValueBar
                  label="Pago"
                  value={o.pago}
                  max={Math.max(o.empenhado ?? 0, o.pago ?? 0)}
                  partial={o.pagamentosSemValor > 0}
                />
                {o.empenhosSemValor + o.pagamentosSemValor > 0 && (
                  <p className="partial small">
                    {o.empenhosSemValor + o.pagamentosSemValor} documentos sem
                    valor informado.
                  </p>
                )}
              </div>
            ))}
            <p className="muted small">
              Fonte: documentos de despesa. Valores ausentes aparecem como não
              informados; somas incompletas, como parciais. O recorte pode
              diferir das alocações.
            </p>
          </section>
        </div>
      )}
      <section className="panel">
        <h2>Completude da cadeia</h2>
        <QueryState
          loading={trace.isLoading}
          error={trace.isError}
          retry={() => void trace.refetch()}
        />
        {trace.data && (
          <>
            <Badge warning={trace.data.atendidos !== trace.data.total}>
              {formatPct(trace.data.score)} · {trace.data.atendidos} de{" "}
              {trace.data.total} critérios presentes
            </Badge>
            <div className="criteria">
              {trace.data.criterios.map((c) => (
                <Badge key={c.nome} warning={!c.atendido}>
                  {c.atendido ? "✓" : "Ausente:"}{" "}
                  {criterionLabels[c.nome] ?? c.nome}
                </Badge>
              ))}
            </div>
            <p className="muted small">
              Completude não certifica regularidade, entrega do serviço ou
              conciliação dos valores.
            </p>
          </>
        )}
      </section>
      <details className="panel extra-details">
        <summary>Localidades, restos a pagar e destino dos pagamentos</summary>
        <p className="muted small">
          Código: {e.codigoEmenda} · Restos inscritos:{" "}
          {formatBRL(e.valorRestoInscrito)}
        </p>
        <p className="muted small">
          Localidades:{" "}
          {[...new Set(e.alocacoes.map((a) => a.localidadeGasto))].join(", ") ||
            "Não informadas"}
        </p>
        <DestinoDoDinheiro codigoEmenda={codigo} />
      </details>
    </div>
  );
}
