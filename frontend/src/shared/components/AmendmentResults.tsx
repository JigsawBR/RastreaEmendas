import { Link } from "react-router-dom";
import { formatBRL } from "../lib/format";
import { Badge } from "./DesignSystem";
import type {
  AmendmentItem,
  AmendmentSourceStrategy,
} from "../lib/amendment-source";
// State numbers already carry the year ("0003/2024"); federal ones do not.
function amendmentLabel(e: AmendmentItem) {
  const number = e.numeroEmenda ?? e.codigoEmenda;
  return number.includes("/") ? number : number + " / " + e.ano;
}
function Completeness({ e }: { e: AmendmentItem }) {
  const { atendidos, total } = e.rastreabilidade;
  if (atendidos === null)
    return (
      <span className="muted small" title="Documentos de despesa não importados para este exercício">
        Não avaliável
      </span>
    );
  return (
    <Badge warning={atendidos < total}>
      {atendidos}/{total}
      <span className="sr-only"> critérios do RF-08 presentes</span>
    </Badge>
  );
}
function amountCell(e: AmendmentItem, phase: "empenhado" | "pago") {
  const value = phase === "empenhado" ? e.valorEmpenhado : e.valorPago;
  return (
    <>
      {value === null ? "Não informado" : formatBRL(value)}
      {"valoresAusentes" in e && e.valoresAusentes[phase] > 0 && (
        <small className="partial">Soma parcial</small>
      )}
    </>
  );
}
export default function AmendmentResults({
  items,
  strategy,
  backTo,
}: {
  items: AmendmentItem[];
  strategy: AmendmentSourceStrategy;
  backTo: string;
}) {
  return (
    <>
      {" "}
      <div className="table-scroll desktop-results">
        <table className="data-table">
          <thead>
            <tr>
              <th>EMENDA / ANO</th>
              <th>PARLAMENTAR</th>
              <th>{strategy.destinationLabel.toUpperCase()}</th>
              <th>EMPENHADO</th>
              <th>PAGO</th>
              <th>
                <abbr title="Critérios do RF-08 presentes: empenho, liquidação, pagamento, função e órgão">
                  COMPLETUDE
                </abbr>
              </th>
              <th>
                <span className="sr-only">Detalhe</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.codigoEmenda}>
                <td>
                  {amendmentLabel(e)}
                  <small>{e.tipoEmenda ?? "Modalidade não informada"}</small>
                </td>
                <td>{e.nomeAutor ?? "Não informado"}</td>
                <td>
                  {strategy.destination(e)}
                  <small>{e.funcoes.join(", ")}</small>
                </td>
                <td>{amountCell(e, "empenhado")}</td>
                <td>{amountCell(e, "pago")}</td>
                <td>
                  <Completeness e={e} />
                </td>
                <td>
                  <Link
                    to={strategy.detailUrl(e)}
                    state={{ backTo }}
                    aria-label={"Ver detalhe da emenda " + e.codigoEmenda}
                  >
                    Ver detalhe →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mobile-results">
        {items.map((e) => (
          <article className="result-card" key={e.codigoEmenda}>
            <h3>Emenda {amendmentLabel(e)}</h3>
            <p>{e.nomeAutor ?? "Parlamentar não informado"}</p>
            <p className="muted">{strategy.destination(e)}</p>
            <p className="muted small">{e.funcoes.join(", ")}</p>
            <dl>
              <div>
                <dt>Empenhado</dt>
                <dd>{amountCell(e, "empenhado")}</dd>
              </div>
              <div>
                <dt>Pago</dt>
                <dd>{amountCell(e, "pago")}</dd>
              </div>
              <div>
                <dt>Completude (RF-08)</dt>
                <dd>
                  <Completeness e={e} />
                </dd>
              </div>
            </dl>
            <Link to={strategy.detailUrl(e)} state={{ backTo }}>
              Ver detalhe →
            </Link>
          </article>
        ))}
      </div>
    </>
  );
}
