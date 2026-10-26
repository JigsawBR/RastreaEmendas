import type { ReactNode } from "react";
import { formatBRL } from "../lib/format";
import { isOngoing } from "../lib/years";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";

export function OngoingYearNotice({ year }: { year: number | null | undefined }) {
  if (!isOngoing(year)) return null;
  return (
    <p className="notice notice-partial">
      <strong>Exercício {year} em andamento.</strong> Os valores vão até a
      última carga dos dados e ainda devem crescer até o fim do ano; compare
      com exercícios fechados com cautela.
    </p>
  );
}

export function Badge({
  children,
  warning = false,
}: {
  children: ReactNode;
  warning?: boolean;
}) {
  return (
    <span className={warning ? "badge badge-warning" : "badge"}>
      {children}
    </span>
  );
}
/** Hero band shared by every screen; `actions` holds the scope controls (year, origin). */
export function PageHeading({
  title,
  description,
  scope = "FEDERAL · PARAÍBA · DADOS ABERTOS",
  actions,
}: {
  title: string;
  description: ReactNode;
  scope?: string;
  actions?: ReactNode;
}) {
  return (
    <section className="dashboard-hero page-heading">
      <div>
        <span className="eyebrow-light">{scope}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="hero-controls">{actions}</div>}
    </section>
  );
}
/** Relative change vs a named period; amounts are neither good nor bad, so it stays neutral ink. */
function Delta({ change, period }: { change: number; period: string }) {
  const direction = change > 0.0005 ? "▲" : change < -0.0005 ? "▼" : "■";
  const text = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0, signDisplay: "exceptZero" }).format(change);
  return (
    <span className="metric-delta">
      <span aria-hidden="true">{direction}</span> {text} vs {period}
    </span>
  );
}

export function Metric({
  label,
  value,
  context,
  icon,
  delta,
}: {
  label: string;
  value: string;
  context: string;
  icon?: IconName;
  delta?: { change: number; period: string } | null;
}) {
  return (
    <div className="panel metric">
      <span className="metric-label">
        {icon && <span className="metric-icon"><Icon name={icon} /></span>}
        {label}
      </span>
      <strong>{value}</strong>
      {delta && <Delta change={delta.change} period={delta.period} />}
      <small>{context}</small>
    </div>
  );
}
export function ValueBar({
  label,
  value,
  max,
  partial = false,
}: {
  label: string;
  value: number | null;
  max: number;
  partial?: boolean;
}) {
  const width =
    value === null || max <= 0
      ? 0
      : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="value-bar">
      <div>
        <span>{label}</span>
        <strong>
          {value === null ? "Não informado" : formatBRL(value)}
          {partial && <small className="partial"> · parcial</small>}
        </strong>
      </div>
      <div className="bar-track" aria-hidden="true">
        <div style={{ width: width + "%" }} />
      </div>
    </div>
  );
}
export function QueryState({
  loading,
  error,
  empty,
  retry,
}: {
  loading?: boolean;
  error?: boolean;
  empty?: string;
  retry?: () => void;
}) {
  if (loading)
    return (
      <div className="notice" role="status">
        Carregando os dados da base…
      </div>
    );
  if (error)
    return (
      <div className="notice notice-error" role="alert">
        <strong>Não foi possível consultar a base.</strong>
        <p>Verifique a conexão e tente novamente.</p>
        {retry && (
          <button className="button secondary" onClick={retry}>
            Tentar novamente
          </button>
        )}
      </div>
    );
  if (empty)
    return (
      <div className="notice">
        <strong>Sem registros neste recorte</strong>
        <p>{empty}</p>
      </div>
    );
  return null;
}
