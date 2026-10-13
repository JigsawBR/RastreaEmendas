import type { ReactNode } from "react";
import { formatBRL } from "../lib/format";

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
export function PageHeading({
  title,
  description,
  scope = "FEDERAL · PARAÍBA · DADOS ABERTOS",
}: {
  title: string;
  description: ReactNode;
  scope?: string;
}) {
  return (
    <div className="page-heading">
      <Badge>{scope}</Badge>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
export function Metric({
  label,
  value,
  context,
}: {
  label: string;
  value: string;
  context: string;
}) {
  return (
    <div className="panel metric">
      <span>{label}</span>
      <strong>{value}</strong>
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
