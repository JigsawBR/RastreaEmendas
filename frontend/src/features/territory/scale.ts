import { formatBRLCompact } from "../../shared/lib/format";

/**
 * Quantile classes for skewed money values. A linear scale would paint almost
 * every city alike (median R$ 0.7 mi against a maximum of R$ 32 mi), so each
 * class holds about the same number of municipalities. Repeated values can
 * merge classes, hence fewer than `classes` breaks.
 */
export function quantileBreaks(values: number[], classes = 5): number[] {
  const positive = values.filter((value) => value > 0).sort((a, b) => a - b);
  if (!positive.length) return [];
  const breaks: number[] = [];
  for (let i = 1; i < classes; i++) {
    const value = positive[Math.floor((i * positive.length) / classes)];
    if (value !== undefined && value > (breaks.at(-1) ?? positive[0])) breaks.push(value);
  }
  return breaks;
}

/** 0 = no value; 1..breaks.length + 1 = class, from lowest to highest. */
export function classOf(value: number, breaks: number[]): number {
  if (!(value > 0)) return 0;
  return 1 + breaks.filter((limit) => value >= limit).length;
}

export function classLabels(values: number[], breaks: number[]): string[] {
  const positive = values.filter((value) => value > 0);
  if (!positive.length) return [];
  const bounds = [Math.min(...positive), ...breaks, Math.max(...positive)];
  return bounds.slice(0, -1).map((lower, i) =>
    i === bounds.length - 2
      ? `${formatBRLCompact(lower)} a ${formatBRLCompact(bounds[i + 1])}`
      : `${formatBRLCompact(lower)} a menos de ${formatBRLCompact(bounds[i + 1])}`,
  );
}
