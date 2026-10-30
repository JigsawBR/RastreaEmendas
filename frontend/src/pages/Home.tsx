import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { getAmendmentSource, isStateSummary } from "../shared/lib/amendment-source";
import type { AmendmentSummary } from "../shared/lib/amendment-source";
import SourceSelector from "../shared/components/SourceSelector";
import { readSource } from "../shared/lib/sources";
import { formatBRLCompact, formatInt } from "../shared/lib/format";
import {
  Metric,
  OngoingYearNotice,
  PageHeading,
  QueryState,
} from "../shared/components/DesignSystem";
import QuickSearch from "../shared/components/QuickSearch";
import { BarList, ShareBar } from "../shared/components/Charts";
import type { ShareSegment } from "../shared/components/Charts";
import DestinoDoDinheiro from "../features/federal-amendments/components/FundingDestinations";
import { api } from "../features/federal-amendments/api";
import type { FunctionTotal } from "../features/federal-amendments/api";
import MiniMap from "../features/territory/MiniMap";
import ExecutionComparison from "../shared/components/ExecutionComparison";
import { YEARS, isOngoing, readYear } from "../shared/lib/years";

const TOP_FUNCTIONS = 6;
// CODATA writes functions in capitals ("SAÚDE"); the CGU, in sentence case.
const sentenceCase = (text: string) =>
  text === text.toLocaleUpperCase("pt-BR")
    ? text.charAt(0) + text.slice(1).toLocaleLowerCase("pt-BR")
    : text;

// The tail folds into one bar instead of a long list of small ones.
function functionRows(rows: FunctionTotal[]) {
  const head = rows.slice(0, TOP_FUNCTIONS);
  const tail = rows.slice(TOP_FUNCTIONS);
  const sum = (field: "empenhado" | "pago") =>
    tail.some((row) => row[field] !== null) ? tail.reduce((total, row) => total + (row[field] ?? 0), 0) : null;
  const all = tail.length ? [...head, { funcao: `Demais funções (${tail.length})`, empenhado: sum("empenhado"), pago: sum("pago") }] : head;
  return all.map((row) => ({
    label: sentenceCase(row.funcao),
    value: row.empenhado,
    detail: row.pago === null ? "Pago não informado" : "Pago " + formatBRLCompact(row.pago),
  }));
}

// Tones mean the same in both origins: 1 municipality, 2 private, 3 public
// body applying it directly, 0 everything else.
const federalTones: Record<string, [ShareSegment["tone"], string]> = {
  municipio: [1, "Municípios"],
  privado: [2, "Empresas e entidades privadas"],
  estado: [3, "Governos estadual e federal"],
  federal: [3, "Governos estadual e federal"],
};
const stateTones: Record<string, [ShareSegment["tone"], string]> = {
  municipal_transfer: [1, "Transferências a municípios"],
  private_nonprofit: [2, "Entidades privadas"],
  private_for_profit: [2, "Entidades privadas"],
  direct_execution: [3, "Aplicação direta pelo Estado"],
};
function toSegments(rows: { key: string; value: number }[], tones: Record<string, [ShareSegment["tone"], string]>) {
  const merged = new Map<string, ShareSegment>();
  for (const row of rows) {
    const [tone, label] = tones[row.key] ?? [0, "Outros e não identificados"];
    const segment = merged.get(label) ?? { key: label, label, value: 0, tone };
    segment.value += row.value;
    merged.set(label, segment);
  }
  return [...merged.values()].sort((a, b) => (a.tone || 9) - (b.tone || 9));
}

function change(current: number | null | undefined, previous: number | null | undefined) {
  return current != null && previous ? (current - previous) / previous : null;
}

export default function Home() {
  const [search, setSearch] = useSearchParams();
  const year = readYear(search.get("ano"));
  const source = readSource(search);
  const strategy = getAmendmentSource(source);
  const query = useQuery({
    queryKey: ["resumo", source, year],
    queryFn: () => strategy.summary(year),
  });
  // A partial year against a closed one would show a fake drop, so deltas only
  // compare closed exercises.
  const previousYear = (YEARS as readonly number[]).includes(year - 1) && !isOngoing(year) ? year - 1 : null;
  const previous = useQuery({
    queryKey: ["resumo", source, previousYear],
    queryFn: () => strategy.summary(previousYear!),
    enabled: previousYear !== null,
  });
  const destination = useQuery({
    queryKey: ["destino", year],
    queryFn: () => api.destino(year),
    enabled: source === "federal",
  });
  const national = useQuery({
    queryKey: ["emendas-nacionais", year],
    queryFn: () => api.nacionais(year),
    enabled: source === "federal",
  });
  const data = query.data;
  const stateSummary = data && isStateSummary(data) ? data : undefined;
  const prior: AmendmentSummary | undefined = previous.data;
  const delta = (current: number | null, before: number | null | undefined) => {
    const value = previousYear ? change(current, before) : null;
    return value === null ? null : { change: value, period: String(previousYear) };
  };
  const segments = stateSummary
    ? toSegments(stateSummary.destinos.porDestino.map((d) => ({ key: d.destino, value: d.valorEmpenhadoLiquido })), stateTones)
    : toSegments((destination.data?.grupos ?? []).map((g) => ({ key: g.destino, value: g.valor })), federalTones);
  const partial = (field: "empenhado" | "liquidado" | "pago") =>
    !!(stateSummary?.valoresAusentes[field] || stateSummary?.emendasSemExecucao);
  return (
    <div className="page-stack">
      <PageHeading
        title="Acompanhe o caminho do recurso público."
        scope={`${source === "estadual" ? "Estadual" : "Federal"} · Paraíba · Exercício ${year}${isOngoing(year) ? " · em andamento" : ""}`}
        description="Da emenda ao pagamento: quanto foi reservado, quanto já foi pago e para onde foi o dinheiro."
        actions={<>
          <label className="field">
            Exercício
            <select value={year} onChange={(e) => setSearch({ ano: e.target.value, origem: source })}>
              {YEARS.map((y) => <option key={y}>{y}</option>)}
            </select>
          </label>
          <SourceSelector value={source} onChange={(value) => setSearch({ ano: String(year), origem: value })} />
          <span className="hero-source">Fonte: {source === "estadual" ? "CODATA" : "CGU"}</span>
        </>}
      />
      <QuickSearch year={year} source={source} />
      <OngoingYearNotice year={year} />
      <QueryState
        loading={query.isLoading}
        error={query.isError}
        retry={() => void query.refetch()}
        empty={data?.totalEmendas === 0 ? "Não há registros carregados para este exercício. Isso não comprova ausência de emendas na fonte." : undefined}
      />
      {data && data.totalEmendas > 0 && (
        <>
          <div className="metrics">
            <Metric icon="committed" label="Empenhado"
              value={data.valorEmpenhado === null ? "Não informado" : formatBRLCompact(data.valorEmpenhado)}
              delta={delta(data.valorEmpenhado, prior?.valorEmpenhado)}
              context={partial("empenhado") ? "Recursos reservados · soma parcial" : "Recursos reservados"} />
            <Metric icon="liquidated" label="Liquidado"
              value={data.valorLiquidado === null ? "Não informado" : formatBRLCompact(data.valorLiquidado)}
              delta={delta(data.valorLiquidado, prior?.valorLiquidado)}
              context={partial("liquidado") ? "Despesas verificadas · soma parcial" : "Despesas verificadas"} />
            <Metric icon="paid" label="Pago"
              value={data.valorPago === null ? "Não informado" : formatBRLCompact(data.valorPago)}
              delta={delta(data.valorPago, prior?.valorPago)}
              context={partial("pago") ? "Pagamentos registrados · soma parcial" : "Pagamentos registrados"} />
            <Metric icon="amendments" label="Emendas no recorte"
              value={formatInt(data.totalEmendas)}
              delta={delta(data.totalEmendas, prior?.totalEmendas)}
              context={formatInt(data.totalParlamentares) + " parlamentares · " + ("totalLocalidades" in data
                ? formatInt(data.totalLocalidades) + " localidades"
                : formatInt(data.totalBeneficiarios) + " beneficiários")} />
          </div>
          <div className="dashboard-grid">
            <ExecutionComparison
              committed={data.valorEmpenhado}
              liquidated={data.valorLiquidado}
              paid={data.valorPago}
              partial={stateSummary ? { committed: partial("empenhado"), liquidated: partial("liquidado"), paid: partial("pago") } : undefined}
              incompleteCoverage={!!stateSummary?.emendasSemExecucao}
            />
            <section className="panel">
              <h2>Para onde foi o dinheiro</h2>
              <p className="panel-subtitle">
                {stateSummary
                  ? "Empenho líquido por quem recebe, segundo a modalidade de aplicação das notas"
                  : "Valor dos empenhos por natureza de quem recebe (favorecido do documento)"}
              </p>
              {segments.length > 0
                ? <ShareBar caption={`Destino do recurso em ${year}`} segments={segments} />
                : <p className="muted small">{destination.isLoading ? "Carregando…" : "Sem destinos identificados neste exercício."}</p>}
              <p className="muted small">
                {stateSummary
                  ? "Para entidades privadas, o município registrado é apenas a sede e não entra no mapa."
                  : "Base diferente dos indicadores acima: documentos de empenho, não alocações. Os totais podem divergir."}
              </p>
            </section>
          </div>
          <div className="dashboard-grid">
            <section className="panel">
              <h2>Por função</h2>
              <p className="panel-subtitle">Valor empenhado em cada área de governo</p>
              <BarList caption={`Valor empenhado por função em ${year}`} rows={functionRows(data.porFuncao ?? [])} />
            </section>
            <section className="panel">
              <h2>No mapa</h2>
              <p className="panel-subtitle">{source === "estadual" ? "Valor transferido a cada município" : "Valor previsto nos planos especiais por município"}</p>
              <MiniMap year={year} indicator={source === "estadual" ? "estadual" : "planos"} />
            </section>
          </div>
        </>
      )}
      {source === "federal" && national.data && national.data.totalEmendas > 0 && (
        <section className="panel national-callout">
          <div>
            <h2>Além do recorte: emendas nacionais</h2>
            <p className="muted small">
              {formatInt(national.data.totalEmendas)} emendas aplicadas em vários estados repassaram{" "}
              <strong>{formatBRLCompact(national.data.recebidoEntes)}</strong> a prefeituras e ao governo da
              Paraíba em {year}. Esse valor não está somado aos indicadores acima.
            </p>
          </div>
          <Link className="button secondary" to={`/emendas-nacionais?ano=${year}`}>Ver emendas nacionais</Link>
        </section>
      )}
      <div className="notice">
        {source === "estadual"
          ? "Fonte: CODATA — Dados Abertos da Paraíba · Execução vinculada por ano e número da emenda"
          : "Fonte: Portal da Transparência (CGU) · Alocações aplicadas na Paraíba: um município, o Estado ou vários municípios"}{" "}
        · Exercício {year}. Ausência de registro não significa ausência de gasto.
        {stateSummary && stateSummary.emendasSemExecucao > 0 &&
          " " + stateSummary.emendasSemExecucao + " emendas da listagem sem execução vinculada; totais com cobertura parcial."}
        {stateSummary && stateSummary.linhasSemListagem > 0 &&
          " " + stateSummary.linhasSemListagem + " linhas de execução sem correspondência na listagem foram excluídas dos totais."}
      </div>
      {source === "federal" && data && data.totalEmendas > 0 && (
        <details className="extra-details">
          <summary>Ver os favorecidos de cada destino</summary>
          <DestinoDoDinheiro ano={year} />
        </details>
      )}
    </div>
  );
}
