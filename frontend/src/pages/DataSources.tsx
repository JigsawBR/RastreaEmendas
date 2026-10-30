import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { getAmendmentSource } from "../shared/lib/amendment-source";
import SourceSelector from "../shared/components/SourceSelector";
import { readSource, sourceLabel } from "../shared/lib/sources";
import { Badge, PageHeading, QueryState } from "../shared/components/DesignSystem";
const years = [2023, 2024, 2025, 2026];
export default function DataSources() {
  const [search, setSearch] = useSearchParams();
  const coverageSource = readSource(search);
  const [source, setSource] = useState("federal");
  const [period, setPeriod] = useState("2023-2026");
  const [refresh, setRefresh] = useState(true);
  const [prepared, setPrepared] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const coverage = useQuery({
    queryKey: ["source-coverage", coverageSource],
    queryFn: () =>
      Promise.all(
        years.map(async (year) => ({
          year,
          summary: await getAmendmentSource(coverageSource).summary(year),
        })),
      ),
  });
  const moduleName = source === "federal" ? "etl.federal"
    : source === "transferegov" ? "etl.federal.load_transferegov"
      : ["evidence", "siconv", "queue"].includes(source) ? "etl.evidence" : "etl.state";
  const supportsRefresh = source !== "transferegov";
  const command =
    "python -m " +
    moduleName +
    " --years " +
    period +
    (source === "siconv" ? " --sources siconv" : source === "queue" ? " --sources queue" : "") +
    (supportsRefresh && refresh ? " --refresh" : "");
  function reset() {
    setPrepared(false);
    setCopied(false);
    setCopyError(false);
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }
  return (
    <div className="page-stack">
      <PageHeading
        scope="PARAÍBA · FONTES PÚBLICAS"
        title="Dados abertos, com contexto."
        description="Conheça as fontes, a cobertura e os limites da informação apresentada."
      />
      <div className="three-columns">
        <section className="panel source-card">
          <Badge>Emendas federais</Badge>
          <h2>Portal da Transparência</h2>
          <p className="muted">
            Identidade, alocações e documentos de despesa. Recorte da Paraíba
            identificado na localidade do gasto e, para as emendas
            &ldquo;MÚLTIPLO&rdquo;, na UF de aplicação do arquivo aberto.
          </p>
          <p className="muted small">Última carga: data não registrada.</p>
        </section>
        <section className="panel source-card">
          <Badge>Transferências especiais</Badge>
          <h2>Transferegov</h2>
          <p className="muted">
            Planos de ação, planos de trabalho e relatórios de gestão, com
            despesas locais declaradas quando disponíveis. Convênios, contratos,
            pagamentos e medições SICONV aparecem como candidatos quando falta
            confirmar o exercício da emenda.
          </p>
          <p className="muted small">Última carga: data não registrada.</p>
        </section>
        <section className="panel source-card">
          <Badge>Emendas estaduais</Badge>
          <h2>Dados Abertos da Paraíba (CODATA)</h2>
          <p className="muted">
            Listagem e execução estadual integradas à consulta. Identificação
            por exercício e número da emenda; valores agregados por órgão e
            função. O detalhe apresenta notas de empenho, liquidações e
            pagamentos da coleta documental, com fontes, datas e lacunas.
            Pagamentos sem exercício do empenho identificado permanecem candidatos.
            Evidências complementares mostram convênios, contratos e entidades
            citadas, com fonte, regra de vínculo e data de coleta.
          </p>
          <p className="muted small">Última carga: data não registrada.</p>
        </section>
      </div>
      <div className="notice">
        Exercícios previstos: 2023 a 2026. Cobertura e atualização devem ser
        confirmadas por fonte. Na base federal, a API registra como
        &ldquo;MÚLTIPLO&rdquo; emendas repartidas entre vários municípios, sem dizer
        a UF; o arquivo aberto da CGU diz, e as aplicadas inteiras na Paraíba
        entram na consulta. Emendas aplicadas em vários estados (Nacional, ou
        MÚLTIPLO em mais de uma UF) não entram nos totais: a parte da Paraíba
        aparece em <Link to="/emendas-nacionais">Emendas nacionais</Link>, pelo
        que prefeituras e o Estado receberam. Na base estadual, o beneficiário
        não é tratado como município.
      </div>
      <section className="panel">
        <h2>
          Cobertura da consulta {sourceLabel(coverageSource).toLowerCase()}
        </h2>
        <SourceSelector
          value={coverageSource}
          onChange={(value) => setSearch({ origem: value })}
        />
        <p className="muted small">
          Quantidade de emendas aplicadas na Paraíba presentes na base. Presença de registros não garante cobertura integral da fonte.
        </p>
        <QueryState
          loading={coverage.isLoading}
          error={coverage.isError}
          retry={() => void coverage.refetch()}
        />
        {coverage.data && (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Exercício</th>
                  <th>Emendas na base</th>
                  <th>Situação</th>
                  <th>
                    <span className="sr-only">Consultar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {coverage.data.map(({ year, summary }) => (
                  <tr key={year}>
                    <td>{year}</td>
                    <td>{summary.totalEmendas}</td>
                    <td>
                      <Badge warning={summary.totalEmendas === 0}>
                        {summary.totalEmendas > 0
                          ? "Registros disponíveis"
                          : "Sem registros carregados"}
                      </Badge>
                    </td>
                    <td>
                      <Link
                        to={
                          "/emendas?ano=" + year + "&origem=" + coverageSource
                        }
                      >
                        Consultar →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="panel">
        <Badge warning>OPERAÇÃO LOCAL · ETL</Badge>
        <h2 style={{ marginTop: 16 }}>Atualizar a base</h2>
        <p className="muted small">
          Prepare o comando da rotina de coleta, transformação e carga. A
          execução ocorre no terminal do administrador, com o ambiente Python e
          as credenciais configurados.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPrepared(true);
          }}
        >
          <div className="import-grid">
            <label className="field">
              Fonte
              <select
                value={source}
                onChange={(e) => {
                  setSource(e.target.value);
                  reset();
                }}
              >
                <option value="federal">Portal da Transparência</option>
                <option value="transferegov">Transferegov</option>
                <option value="state">CODATA — Dados Abertos da Paraíba</option>
                <option value="evidence">Evidências estaduais e transferências especiais</option>
                <option value="siconv">SICONV — convênios e execução local</option>
                <option value="queue">CODATA — contexto da fila de pagamentos</option>
              </select>
            </label>
            <label className="field">
              Período
              <select
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value);
                  reset();
                }}
              >
                <option value="2023-2026">2023 a 2026</option>
                {years.map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Modo
              <select
                disabled={!supportsRefresh}
                value={supportsRefresh && !refresh ? "cache" : "refresh"}
                onChange={(e) => {
                  setRefresh(e.target.value === "refresh");
                  reset();
                }}
              >
                <option value="refresh">Consultar novamente a fonte</option>
                {supportsRefresh && (
                  <option value="cache">Reutilizar o cache disponível</option>
                )}
              </select>
            </label>
          </div>
          <div className="filter-actions">
            <button type="submit" className="button">
              Preparar atualização
            </button>
            <span className="muted small">
              O botão prepara o comando; não inicia uma carga no servidor.
            </span>
          </div>
        </form>
        {prepared && (
          <div className="command-box" role="status">
            <h3>Comando pronto para execução local</h3>
            <code>{command}</code>
            <button className="button secondary" onClick={() => void copy()}>
              {copied ? "Copiado" : "Copiar comando"}
            </button>
            {copyError && (
              <p className="muted small">
                Não foi possível copiar automaticamente. Selecione e copie o
                comando acima.
              </p>
            )}
            <p className="muted small">
              Execute na raiz do projeto com o ambiente virtual ativo. O
              andamento e as falhas são exibidos no terminal. A interface não
              acompanha a execução.
            </p>
          </div>
        )}
      </section>
      <div className="two-columns">
        <section className="panel source-card">
          <Badge warning>Fonte indisponível</Badge>
          <p className="muted small">
            Uma falha de consulta não comprova ausência de gasto. Confira os
            registros da rotina e a última carga válida antes de comparar.
          </p>
        </section>
        <section className="panel source-card">
          <Badge warning>Dados parciais</Badge>
          <p className="muted small">
            Valor ausente aparece como não informado. Uma fase sem documentos
            permanece visível. Completude não certifica regularidade ou
            conciliação dos valores.
          </p>
        </section>
      </div>
      <div>
        <Link className="button" to="/">
          Voltar à visão geral
        </Link>
      </div>
    </div>
  );
}
