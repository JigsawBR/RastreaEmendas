export function serializeCsv(
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
): string {
  function cell(value: unknown): string {
    if (value === null || value === undefined) return "";
    let text = String(value);
    if (
      /^[=+@\t\r]/.test(text) ||
      (text.startsWith("-") && typeof value !== "number")
    )
      text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return (
    "\uFEFF" +
    [headers.join(";"), ...rows.map((row) => row.map(cell).join(";"))].join(
      "\n",
    )
  );
}
