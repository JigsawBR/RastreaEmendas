import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAmendmentSearch } from "../shared/hooks/useAmendmentSearch";
import { loadGeography } from "../features/territory/api";
import { amendmentOrders } from "../shared/lib/amendment-order";
import type { AmendmentOrder } from "../shared/lib/amendment-order";
import { sourceLabel } from "../shared/lib/sources";
import { formatInt } from "../shared/lib/format";
import { Badge, PageHeading, QueryState } from "../shared/components/DesignSystem";
import SourceSelector from "../shared/components/SourceSelector";
import AmendmentResults from "../shared/components/AmendmentResults";
export default function EmendasList() {
  const {
    source,
    strategy,
    draft,
    setDraft,
    query,
    coverage,
    page,
    activeLabels,
    backTo,
    exportUrl,
    totalPages,
    order,
    apply,
    changeOrder,
    changeSource,
    goToPage,
    clear,
  } = useAmendmentSearch();
  const data = query.data;
  const geography = useQuery({
    queryKey: ["pb-geography"],
    queryFn: loadGeography,
    staleTime: Infinity,
    enabled: strategy.fields.some((field) => field.suggestions),
  });
  const municipalities = useMemo(
    () =>
      (geography.data?.features ?? [])
        .map((feature) => feature.properties.name)
        .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [geography.data],
  );
  return (
    <div className="page-stack">
      <PageHeading
        title="Encontre e acompanhe uma emenda."
        scope={sourceLabel(source).toUpperCase() + " · PARAÍBA · DADOS ABERTOS"}
        description="Combine os filtros para explorar os recursos destinados à Paraíba."
      />
      <div className="scope-row">
        <SourceSelector value={source} onChange={changeSource} />
      </div>
      <details className="panel filters-disclosure" open>
        <summary>Filtros da consulta</summary>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            apply();
          }}
        >
          <div className="filters-grid">
            <label className="field">
              Exercício
              <select
                value={draft.ano}
                onChange={(event) =>
                  setDraft({ ...draft, ano: event.target.value })
                }
              >
                <option value="">Todos os anos</option>
                {[2026, 2025, 2024, 2023].map((year) => (
                  <option key={year}>{year}</option>
                ))}
              </select>
            </label>
            {strategy.fields.map((field) => (
              <label className="field" key={field.key}>
                {field.label}
                <input
                  value={draft[field.key]}
                  placeholder={field.placeholder}
                  list={field.suggestions ? "municipality-options" : undefined}
                  onChange={(event) =>
                    setDraft({ ...draft, [field.key]: event.target.value })
                  }
                />
                {field.suggestions && (
                  <datalist id="municipality-options">
                    {municipalities.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                )}
              </label>
            ))}
          </div>
          <div className="filter-actions">
            <button className="button" type="submit">
              Aplicar filtros
            </button>
            <button className="text-button" type="button" onClick={clear}>
              Limpar filtros
            </button>
            <Badge>{sourceLabel(source)} · Paraíba</Badge>
          </div>
        </form>
      </details>
      <section
        className="panel"
        aria-label="Resultados da consulta"
        aria-busy={query.isFetching}
      >
        <div className="results-header">
          <div>
            <h2>
              {data
                ? formatInt(data.total) + " emendas encontradas"
                : "Resultados da consulta"}
            </h2>
            <p className="muted small">
              {activeLabels || "Todos os exercícios · sem filtros adicionais"}
            </p>
          </div>
          <div className="results-actions">
            <label className="field inline-field">
              Ordenar por
              <select
                value={order}
                onChange={(event) =>
                  changeOrder(event.target.value as AmendmentOrder)
                }
              >
                {amendmentOrders.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {data && data.total > 0 && (
              <a className="button secondary" href={exportUrl}>
                Exportar CSV
              </a>
            )}
          </div>
        </div>
        <QueryState
          loading={query.isLoading}
          error={query.isError}
          retry={() => void query.refetch()}
          empty={
            data?.total === 0
              ? coverage.data?.totalEmendas === 0
                ? "O exercício não tem registros na base carregada. Consulte a cobertura na página Sobre os dados."
                : "Nenhum registro corresponde aos filtros aplicados. Revise os critérios de busca."
              : undefined
          }
        />
        {data && data.items.length > 0 && (
          <AmendmentResults
            items={data.items}
            strategy={strategy}
            backTo={backTo}
          />
        )}
        {data && data.total > 0 && (
          <div className="pagination">
            <span>
              Página {page + 1} de {totalPages} · {formatInt(data.total)}{" "}
              resultados
            </span>
            <div>
              <button
                className="button secondary"
                disabled={page === 0 || query.isFetching}
                onClick={() => goToPage(page - 1)}
              >
                Anterior
              </button>
              <button
                className="button secondary"
                disabled={page + 1 >= totalPages || query.isFetching}
                onClick={() => goToPage(page + 1)}
              >
                Próxima
              </button>
            </div>
          </div>
        )}
        {data && data.total > 0 && data.items.length === 0 && (
          <div className="notice">
            Esta página não possui resultados.{" "}
            <button className="text-button" onClick={() => goToPage(0)}>
              Voltar à primeira página
            </button>
          </div>
        )}
      </section>
      <div className="notice">
        Os resultados mostram o que está na base carregada. Ausência de
        registros não comprova ausência de emendas na fonte.
        {source === "estadual" &&
          " Fonte: CODATA. O beneficiário não é tratado como município. Os totais refletem as linhas de execução que correspondem aos filtros; o detalhe mostra a execução completa da emenda."}
      </div>
    </div>
  );
}
