import { formatBRL, formatBRLCompact, formatPct } from "../lib/format";

/**
 * Horizontal bars for one series (one color for every bar: the categories have
 * no order, so a value ramp would only repeat the bar length). The label and the
 * value are always visible text, so the tooltip never gates a value.
 */
export function BarList({ rows, caption }: {
  rows: { label: string; value: number | null; detail?: string }[];
  caption: string;
}) {
  const max = Math.max(...rows.map((row) => row.value ?? 0), 0);
  return (
    <ul className="bar-list" aria-label={caption}>
      {rows.map((row) => {
        const width = row.value && max > 0 ? Math.max(1, (row.value / max) * 100) : 0;
        const value = row.value === null ? "Não informado" : formatBRLCompact(row.value);
        return (
          <li key={row.label} title={`${row.label}: ${row.value === null ? "não informado" : formatBRL(row.value)}${row.detail ? " · " + row.detail : ""}`}>
            <div className="bar-list-head">
              <span>{row.label}</span>
              <strong>{value}</strong>
            </div>
            <div className="bar-list-track" aria-hidden="true">
              <div style={{ width: width + "%" }} />
            </div>
            {row.detail && <small>{row.detail}</small>}
          </li>
        );
      })}
    </ul>
  );
}

export type ShareSegment = { key: string; label: string; value: number; tone: 1 | 2 | 3 | 0 };

/**
 * Part-to-whole in one stacked bar (at most four groups; tone 0 is the neutral
 * "other"). The legend under the bar is the table view: label, value and share.
 */
export function ShareBar({ segments, caption }: { segments: ShareSegment[]; caption: string }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total <= 0) return null;
  const visible = segments.filter((segment) => segment.value > 0);
  return (
    <figure className="share-bar">
      <div className="share-bar-track" role="img" aria-label={caption}>
        {visible.map((segment) => (
          <div key={segment.key} className={`share-tone-${segment.tone}`} style={{ flexGrow: segment.value }}
            title={`${segment.label}: ${formatBRL(segment.value)} (${formatPct(segment.value / total)})`} />
        ))}
      </div>
      <ul className="share-legend">
        {visible.map((segment) => (
          <li key={segment.key}>
            <i className={`share-swatch share-tone-${segment.tone}`} aria-hidden="true" />
            <span>{segment.label}</span>
            <strong>{formatBRLCompact(segment.value)}</strong>
            <small>{formatPct(segment.value / total)}</small>
          </li>
        ))}
      </ul>
    </figure>
  );
}
