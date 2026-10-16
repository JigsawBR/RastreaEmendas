export type AmendmentSource = "federal" | "estadual";
export function readSource(search: URLSearchParams): AmendmentSource {
  return search.get("origem") === "estadual" ? "estadual" : "federal";
}
export function sourceLabel(source: AmendmentSource): string {
  return source === "estadual" ? "Estadual" : "Federal";
}
