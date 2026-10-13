import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "react-router-dom";
import { stateApi } from "../lib/state-api";
import type { StateDistribution } from "../lib/state-api";
import { formatBRL, formatBRLCompact, formatDate } from "../lib/format";
import {
  Badge,
  Metric,
  PageHeading,
  QueryState,
  ValueBar,
} from "../components/DesignSystem";
const amount = (value: number | null) =>
  value === null ? "Não informado" : formatBRL(value);
const compact = (value: number | null) =>
  value === null ? "Não informado" : formatBRLCompact(value);
function Distribution({
  title,
  groups,
}: {
  title: string;
  groups: StateDistribution[];
}) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {groups.length === 0 && (
        <p className="muted">Sem execução vinculada na base carregada.</p>
      )}
      {groups.map((group, index) => (
        <div className="distribution-item" key={index}>
          <h3>
            {group.rotulo}
            {group.codigoOrgao && " · órgão " + group.codigoOrgao}
          </h3>
          <ValueBar
            label="Empenhado"
            value={group.valorEmpenhado}
            max={Math.max(group.valorEmpenhado ?? 0, group.valorPago ?? 0)}
            partial={group.valoresAusentes.empenhado > 0}
          />
          <ValueBar
            label="Pago"
            value={group.valorPago}
            max={Math.max(group.valorEmpenhado ?? 0, group.valorPago ?? 0)}
            partial={group.valoresAusentes.pago > 0}
          />
        </div>
      ))}
      <p className="muted small">
        Fonte: execução estadual da CODATA. Somatórios excluem valores ausentes
        e são identificados como parciais.
      </p>
    </section>
  );
}
export default function StateAmendmentDetail() {
  const { ano = "", numero = "" } = useParams();
  const location = useLocation();
  const returnPath = (location.state as { backTo?: string } | null)?.backTo;
  const backTo = returnPath?.startsWith("/emendas?")
    ? returnPath
    : "/emendas?origem=estadual&ano=" + encodeURIComponent(ano);
  const query = useQuery({
    queryKey: ["state-amendment", ano, numero],
    queryFn: () => stateApi.amendment(Number(ano), numero),
  });
  if (!query.data)
    return (
      <div className="page-stack">
        <Link to={backTo}>← Voltar à consulta filtrada</Link>
        <QueryState
          loading={query.isLoading}
          error={query.isError}
          retry={() => void query.refetch()}
        />
      </div>
    );
  const e = query.data;
  const comparable =
    e.valorEmpenhado !== null &&
    e.valorPago !== null &&
    e.valoresAusentes.empenhado === 0 &&
    e.valoresAusentes.pago === 0;
  const difference = comparable ? e.valorEmpenhado! - e.valorPago! : null;
  const phases = [
    {
      label: "Empenho",
      value: e.valorEmpenhado,
      missing: e.valoresAusentes.empenhado,
      description: "Compromisso informado",
    },
    {
      label: "Liquidação",
      value: e.valorLiquidado,
      missing: e.valoresAusentes.liquidado,
      description: "Despesa verificada",
    },
    {
      label: "Pagamento",
      value: e.valorPago,
      missing: e.valoresAusentes.pago,
      description: "Desembolso informado",
    },
  ];
  return (
    <div className="page-stack">
      <PageHeading
        title={"Emenda estadual " + e.numeroEmenda}
        scope="ESTADUAL · PARAÍBA · CODATA"
        description={
          <>
            {e.nomeAutor ?? "Parlamentar não informado"} /{" "}
            {e.tipoEmenda ?? "Modalidade não informada"} / Exercício {e.ano}
          </>
        }
      />
      <Link to={backTo}>← Voltar à consulta filtrada</Link>
      <div className="metrics">
        <Metric
          label="Empenhado"
          value={compact(e.valorEmpenhado)}
          context={
            e.valoresAusentes.empenhado
              ? "Compromisso registrado · soma parcial"
              : "Compromisso registrado"
          }
        />
        <Metric
          label="Liquidado"
          value={compact(e.valorLiquidado)}
          context={
            e.valoresAusentes.liquidado
              ? "Despesa verificada · soma parcial"
              : "Despesa verificada"
          }
        />
        <Metric
          label="Pago"
          value={compact(e.valorPago)}
          context={
            e.valoresAusentes.pago
              ? "Pagamento informado · soma parcial"
              : "Pagamento informado"
          }
        />
        <Metric
          label="Diferença"
          value={difference === null ? "Não calculável" : compact(difference)}
          context={
            comparable ? "Empenhado − pago" : "Valores ausentes ou parciais"
          }
        />
      </div>
      <div className="notice">
        A diferença não equivale a saldo disponível ou dívida comprovada. A
        presença de valores agregados não comprova a conciliação de documentos
        individuais.
      </div>
      <section className="panel">
        <h2>Destinação da emenda</h2>
        <p>
          <strong>Beneficiário:</strong>{" "}
          {e.beneficiarioFinal ?? "Não informado"}
        </p>
        <p>
          <strong>Secretaria:</strong> {e.secretaria ?? "Não informada"}
        </p>
        <p>
          <strong>Objeto:</strong> {e.objeto ?? "Não informado"}
        </p>
        <p className="muted small">
          Valor destinado na listagem: {amount(e.valorDestinado)} · Envio:{" "}
          {e.dataEnvio ? formatDate(e.dataEnvio) : "Data não informada"}. O
          beneficiário não é automaticamente identificado como município.
        </p>
      </section>
      <section className="panel">
        <h2>Execução informada pela CODATA</h2>
        <p className="muted small">
          Listagem e execução vinculadas pelo exercício e número da emenda. A
          base carregada fornece valores agregados por classificação
          orçamentária, sem documentos individualizados das três fases.
        </p>
        {e.totalLinhasExecucao === 0 && (
          <div className="notice">
            Nenhuma linha de execução foi vinculada a esta emenda. Isso não
            comprova ausência de execução na fonte.
          </div>
        )}
        <div className="phase-grid">
          {phases.map((phase, i) => (
            <div className="panel phase-card" key={phase.label}>
              <Badge warning={phase.value === null}>
                {"0" + (i + 1)} / {phase.label}
              </Badge>
              <strong>{amount(phase.value)}</strong>
              <p>{phase.description}</p>
              <small>
                {e.totalLinhasExecucao - phase.missing} linhas com valor
                informado
                {phase.missing > 0 &&
                  " · " + phase.missing + " sem valor · soma parcial"}
              </small>
            </div>
          ))}
        </div>
        {e.execucoes.length > 0 && (
          <div className="documents">
            <h3>Registros de execução por órgão e função</h3>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Órgão</th>
                    <th>Função / classificação</th>
                    <th>Empenhado</th>
                    <th>Liquidado</th>
                    <th>Pago</th>
                  </tr>
                </thead>
                <tbody>
                  {e.execucoes.map((row) => (
                    <tr key={row.id}>
                      <td>
                        {row.nomeOrgao ?? "Nome não informado"}
                        <small>
                          Código: {row.codigoOrgao ?? "não informado"}
                        </small>
                      </td>
                      <td>
                        {row.funcao ?? "Não informada"}
                        <small>{row.subfuncao ?? ""}</small>
                        <small>{row.acao ?? row.programa ?? ""}</small>
                      </td>
                      <td>{amount(row.valorEmpenhado)}</td>
                      <td>{amount(row.valorLiquidado)}</td>
                      <td>{amount(row.valorPago)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
      <div className="two-columns">
        <Distribution title="Distribuição por função" groups={e.porFuncao} />
        <Distribution
          title="Distribuição por órgão executor"
          groups={e.porOrgao}
        />
      </div>
      <section className="panel">
        <h2>Completude da cadeia</h2>
        <Badge warning>RF-08 · não avaliável nesta base</Badge>
        <p className="muted small">
          {e.rastreabilidade.motivo} Não é possível atribuir o mesmo percentual
          de rastreabilidade documental usado na consulta federal. Isso não
          significa que a emenda não tenha execução.
        </p>
      </section>
      <div className="notice">
        Fonte: API de Dados Abertos da Paraíba (CODATA) · Listagem e execução de
        emendas estaduais · Data da última carga: não registrada.
      </div>
    </div>
  );
}
