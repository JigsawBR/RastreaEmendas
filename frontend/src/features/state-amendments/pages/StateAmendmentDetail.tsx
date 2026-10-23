import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "react-router-dom";
import { stateApi } from "../api";
import type { StateDistribution } from "../api";
import { StateTrail } from "../components/StateTrail";
import { EvidencePanel } from "../../../shared/components/EvidencePanel";
import { formatBRL, formatBRLCompact, formatDate } from "../../../shared/lib/format";
import {
  Badge,
  Metric,
  PageHeading,
  QueryState,
  ValueBar,
} from "../../../shared/components/DesignSystem";
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
          <strong>Município beneficiado:</strong>{" "}
          {e.municipiosBeneficiados.length
            ? e.municipiosBeneficiados.join(", ")
            : "Não identificado"}
        </p>
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
        {e.destinos.length > 0 && (
          <div className="documents">
            <h3>Para quem o empenho foi feito</h3>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Credor</th>
                    <th>Modalidade de aplicação</th>
                    <th>Município</th>
                    <th>Empenho líquido</th>
                  </tr>
                </thead>
                <tbody>
                  {e.destinos.map((d, i) => (
                    <tr key={i}>
                      <td>
                        {d.credor ?? "Não informado"}
                        <small>{d.documentoCredor ?? ""}</small>
                      </td>
                      <td>
                        {d.destinoRotulo}
                        <small>
                          {d.modalidadeAplicacao
                            ? "Modalidade " + d.modalidadeAplicacao
                            : ""}
                        </small>
                      </td>
                      <td>
                        {d.municipioBeneficiado ? (
                          <>
                            {d.municipioBeneficiado}
                            <small>Município beneficiado</small>
                          </>
                        ) : d.municipioCredor ? (
                          <>
                            {d.municipioCredor}
                            <small>Sede do credor, não município beneficiado</small>
                          </>
                        ) : (
                          "Não informado"
                        )}
                      </td>
                      <td className="amount">
                        {formatBRL(d.valorEmpenhadoLiquido)}
                        <small>
                          {d.notas} {d.notas === 1 ? "nota" : "notas"}
                        </small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted small">
              A modalidade de aplicação da nota de empenho indica quem recebe o
              recurso. Só a transferência ao município identifica a cidade
              beneficiada; para entidades privadas, o município registrado é a
              sede. Valores somam principal, reforços e anulações.
            </p>
          </div>
        )}
      </section>
      <section className="panel">
        <h2>Execução informada pela CODATA</h2>
        <p className="muted small">
          Listagem e execução vinculadas pelo exercício e número da emenda. A
          execução agregada fornece valores por classificação orçamentária.
          Os documentos vinculados são apresentados separadamente abaixo.
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
                {e.totalLinhasExecucao - phase.missing}{" "}
                {e.totalLinhasExecucao - phase.missing === 1
                  ? "linha com valor informado"
                  : "linhas com valor informado"}
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
                      <td className="amount">{amount(row.valorEmpenhado)}</td>
                      <td className="amount">{amount(row.valorLiquidado)}</td>
                      <td className="amount">{amount(row.valorPago)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
      <StateTrail amendment={e} />
      <EvidencePanel origin="state" year={e.ano} number={e.numeroEmenda} />
      <div className="two-columns">
        <Distribution title="Distribuição por função" groups={e.porFuncao} />
        <Distribution
          title="Distribuição por órgão executor"
          groups={e.porOrgao}
        />
      </div>
      <section className="panel">
        <h2>Completude da cadeia</h2>
        <Badge warning={!e.rastreabilidade.completa}>
          {e.rastreabilidade.avaliavel ? `RF-08 · ${e.rastreabilidade.score}% dos critérios documentados` : "RF-08 · não avaliável nesta base"}
        </Badge>
        {e.rastreabilidade.avaliavel && !e.rastreabilidade.coberturaCompleta && <p className="notice">Coleta parcial do exercício. O percentual considera somente as evidências carregadas.</p>}
        <ul>{e.rastreabilidade.criterios?.map(criterion => <li key={criterion.codigo}>{criterion.rotulo}: {criterion.presente ? "localizado" : "não localizado"}</li>)}</ul>
        <p className="muted small">
          {e.rastreabilidade.motivo} Evidência não localizada não significa ausência de execução.
        </p>
      </section>
      <div className="notice">
        Fonte: API de Dados Abertos da Paraíba (CODATA) · Listagem e execução de
        emendas estaduais e documentos de despesa. Os valores agregados e as movimentações documentais têm escopos próprios.
      </div>
    </div>
  );
}
