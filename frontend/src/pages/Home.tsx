import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { getAmendmentSource, isStateSummary } from "../lib/amendment-source";
import SourceSelector from "../components/SourceSelector";
import { readSource, sourceLabel } from "../lib/sources";
import { formatBRLCompact, formatInt } from "../lib/format";
import {
  Badge,
  Metric,
  PageHeading,
  QueryState,
} from "../components/DesignSystem";
import DestinoDoDinheiro from "../components/DestinoDoDinheiro";
import ExecutionComparison from "../components/ExecutionComparison";
export default function Home() {
  const [search, setSearch] = useSearchParams();
  const year = [2023, 2024, 2025, 2026].includes(Number(search.get("ano")))
    ? Number(search.get("ano"))
    : 2024;
  const source = readSource(search);
  const strategy = getAmendmentSource(source);
  const query = useQuery({
    queryKey: ["resumo", source, year],
    queryFn: () => strategy.summary(year),
  });
  const data = query.data;
  const stateSummary = data && isStateSummary(data) ? data : undefined;
  return (
    <div className="page-stack">
      <PageHeading
        title="Acompanhe o caminho do recurso público."
        scope={sourceLabel(source).toUpperCase() + " · PARAÍBA · DADOS ABERTOS"}
        description="Da emenda ao pagamento: explore a execução de recursos destinados à Paraíba."
      />
      <div className="scope-row">
        <label className="field">
          Exercício
          <select
            value={year}
            onChange={(e) => setSearch({ ano: e.target.value, origem: source })}
          >
            {[2026, 2025, 2024, 2023].map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
        <SourceSelector
          value={source}
          onChange={(value) => setSearch({ ano: String(year), origem: value })}
        />
        <Badge>{source === "estadual" ? "Fonte: CODATA" : "Fonte: CGU"}</Badge>
      </div>
      <QueryState
        loading={query.isLoading}
        error={query.isError}
        retry={() => void query.refetch()}
        empty={
          data?.totalEmendas === 0
            ? "Não há registros carregados para este exercício. Isso não comprova ausência de emendas na fonte."
            : undefined
        }
      />
      {data && data.totalEmendas > 0 && (
        <div className="metrics">
          <Metric
            label="Empenhado"
            value={
              data.valorEmpenhado === null
                ? "Não informado"
                : formatBRLCompact(data.valorEmpenhado)
            }
            context={
              stateSummary?.valoresAusentes.empenhado ||
              stateSummary?.emendasSemExecucao
                ? "Recursos comprometidos · soma parcial"
                : "Recursos comprometidos"
            }
          />
          <Metric
            label="Liquidado"
            value={
              data.valorLiquidado === null
                ? "Não informado"
                : formatBRLCompact(data.valorLiquidado)
            }
            context={
              stateSummary?.valoresAusentes.liquidado ||
              stateSummary?.emendasSemExecucao
                ? "Despesas verificadas · soma parcial"
                : "Despesas verificadas"
            }
          />
          <Metric
            label="Pago"
            value={
              data.valorPago === null
                ? "Não informado"
                : formatBRLCompact(data.valorPago)
            }
            context={
              stateSummary?.valoresAusentes.pago ||
              stateSummary?.emendasSemExecucao
                ? "Pagamentos registrados · soma parcial"
                : "Pagamentos registrados"
            }
          />
          <Metric
            label="Emendas no recorte"
            value={formatInt(data.totalEmendas)}
            context={
              formatInt(data.totalParlamentares) +
              " parlamentares · " +
              ("totalLocalidades" in data
                ? formatInt(data.totalLocalidades) + " localidades"
                : formatInt(data.totalBeneficiarios) + " beneficiários")
            }
          />
        </div>
      )}
      <div className="analysis-grid">
        {data && data.totalEmendas > 0 ? (
          <ExecutionComparison
            committed={data.valorEmpenhado}
            liquidated={data.valorLiquidado}
            paid={data.valorPago}
            partial={
              stateSummary
                ? {
                    committed: stateSummary.valoresAusentes.empenhado > 0,
                    liquidated: stateSummary.valoresAusentes.liquidado > 0,
                    paid: stateSummary.valoresAusentes.pago > 0,
                  }
                : undefined
            }
            incompleteCoverage={!!stateSummary?.emendasSemExecucao}
          />
        ) : (
          <section className="panel">
            <h2>Do compromisso ao pagamento</h2>
            <p className="muted">
              A comparação será exibida quando houver dados disponíveis para o
              exercício selecionado.
            </p>
          </section>
        )}
        <section className="panel explore">
          <h2>Encontre uma emenda</h2>
          <p>
            Filtre por município, parlamentar, função ou órgão executor e
            acompanhe os documentos de cada fase.
          </p>
          <Link
            className="button"
            to={"/emendas?ano=" + year + "&origem=" + source}
          >
            Consultar emendas
          </Link>
          <h3>Como interpretar os dados?</h3>
          <p className="small">
            Ausência de registro não significa ausência de gasto. Veja a
            cobertura das fontes antes de comparar.
          </p>
          <Link className="button" to="/sobre-os-dados">
            Conhecer as fontes
          </Link>
        </section>
      </div>
      <div className="notice">
        {source === "estadual"
          ? "Fonte: CODATA — Dados Abertos da Paraíba · Execução vinculada por ano e número da emenda"
          : "Fonte: Portal da Transparência (CGU) · Alocações com localidade explícita na Paraíba"}{" "}
        · Exercício {year}. Data da última carga: não registrada.
        {stateSummary &&
          stateSummary.emendasSemExecucao > 0 &&
          " " +
            stateSummary.emendasSemExecucao +
            " emendas da listagem sem execução vinculada; totais com cobertura parcial."}
        {stateSummary &&
          stateSummary.linhasSemListagem > 0 &&
          " " +
            stateSummary.linhasSemListagem +
            " linhas de execução sem correspondência na listagem foram excluídas dos totais."}
      </div>
      {source === "federal" && data && data.totalEmendas > 0 && (
        <details className="extra-details">
          <summary>Explorar o destino dos pagamentos</summary>
          <DestinoDoDinheiro ano={year} />
        </details>
      )}
    </div>
  );
}
