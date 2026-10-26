/** Exercises loaded by the ETL, newest first. The default is the newest one. */
export const YEARS = [2026, 2025, 2024, 2023] as const;
export const DEFAULT_YEAR: number = YEARS[0];

export function readYear(value: string | null): number {
  const year = Number(value);
  return (YEARS as readonly number[]).includes(year) ? year : DEFAULT_YEAR;
}

/** The current exercise is still being executed: its totals are partial. */
export const isOngoing = (year: number | null | undefined) =>
  year === new Date().getFullYear();
