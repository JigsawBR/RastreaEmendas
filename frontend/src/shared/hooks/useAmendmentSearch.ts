import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { readSource } from "../lib/sources";
import type { AmendmentSource } from "../lib/sources";
import { getAmendmentSource } from "../lib/amendment-source";
import type { SearchFilters } from "../lib/amendment-source";
import { readOrder } from "../lib/amendment-order";
import { DEFAULT_YEAR } from "../lib/years";
import type { AmendmentOrder } from "../lib/amendment-order";
const PAGE_SIZE = 20;
function readFilters(search: URLSearchParams): SearchFilters {
  const year = search.get("ano") ?? String(DEFAULT_YEAR);
  const validYear =
    year === "" ||
    (/^\d+$/.test(year) && Number(year) > 0 && Number(year) <= 9999);
  return {
    ano: validYear ? year : String(DEFAULT_YEAR),
    municipio: search.get("municipio") ?? "",
    beneficiario: search.get("beneficiario") ?? "",
    parlamentar: search.get("parlamentar") ?? "",
    funcao: search.get("funcao") ?? "",
    orgao: search.get("orgao") ?? "",
  };
}
export function useAmendmentSearch() {
  const [search, setSearch] = useSearchParams();
  const source = readSource(search);
  const strategy = getAmendmentSource(source);
  const [draft, setDraft] = useState(() => readFilters(search));
  const queryString = search.toString();
  useEffect(() => {
    setDraft(readFilters(new URLSearchParams(queryString)));
  }, [queryString]);
  const filters = readFilters(search);
  const requestedPage = Number(search.get("pagina") ?? "1");
  const page =
    Number.isSafeInteger(requestedPage) &&
    requestedPage > 0 &&
    (requestedPage - 1) * PAGE_SIZE <= 2147483647
      ? requestedPage - 1
      : 0;
  const order = readOrder(search.get("ordem"));
  const params = {
    ...strategy.params(filters, { limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    // The default order is omitted so that it stays out of URLs and cache keys.
    ordem: order === "recentes" ? undefined : order,
  };
  const query = useQuery({
    queryKey: ["emendas", source, params],
    queryFn: () => strategy.list(params),
  });
  const coverage = useQuery({
    queryKey: ["resumo", source, params.ano],
    queryFn: () => strategy.summary(params.ano),
  });
  const activeLabels = [
    { key: "ano" as const, label: "Exercício" },
    ...strategy.fields,
  ]
    .filter((field) => filters[field.key])
    .map((field) => field.label + ": " + filters[field.key])
    .join(" · ");
  function apply() {
    const next = new URLSearchParams({ origem: source, ano: draft.ano });
    for (const field of strategy.fields) {
      if (draft[field.key].trim()) next.set(field.key, draft[field.key].trim());
    }
    if (order !== "recentes") next.set("ordem", order);
    setSearch(next);
  }
  function changeOrder(value: AmendmentOrder) {
    const next = new URLSearchParams(search);
    if (value === "recentes") next.delete("ordem");
    else next.set("ordem", value);
    next.delete("pagina");
    setSearch(next);
  }
  function changeSource(value: AmendmentSource) {
    const next = new URLSearchParams(search);
    next.set("origem", value);
    // Federal municipio is a free-text locality; the state one must be an
    // official name, so the value is not carried across sources.
    next.delete("municipio");
    next.delete("beneficiario");
    next.delete("pagina");
    setSearch(next);
  }
  function goToPage(value: number) {
    const next = new URLSearchParams(search);
    next.set("pagina", String(value + 1));
    setSearch(next);
  }
  return {
    source,
    strategy,
    draft,
    setDraft,
    query,
    coverage,
    page,
    activeLabels,
    backTo: "/emendas?" + search.toString(),
    exportUrl: strategy.exportUrl(params),
    totalPages: Math.max(1, Math.ceil((query.data?.total ?? 0) / PAGE_SIZE)),
    order,
    apply,
    changeOrder,
    changeSource,
    goToPage,
    clear: () => setSearch({ origem: source, ano: "" }),
  };
}
