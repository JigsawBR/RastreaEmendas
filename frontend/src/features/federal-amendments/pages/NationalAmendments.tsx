import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import type { EmendaNacional, EmendaNacionalDetail } from "../api";
import PlacesMap from "../../territory/PlacesMap";
import type { Place } from "../../territory/PlacesMap";
import { formatBRL, formatBRLCompact, formatInt } from "../../../shared/lib/format";
import { Metric, OngoingYearNotice, PageHeading, QueryState } from "../../../shared/components/DesignSystem";
import { YEARS, readYear } from "../../../shared/lib/years";

const sphereLabels = { municipal: "Prefeitura ou fundo municipal", estadual: "Governo do Estado", privado: "Entidade privada" };

// Only a municipal recipient makes its city a beneficiary; the state's and a
// private entity's municipality is just where they are registered.
function recipientPlaces(detail: EmendaNacionalDetail): Place[] {
  return detail.favorecidos
    .filter((f) => f.codigoIbge)
    .map((f) => ({
      code: f.codigoIbge!, name: f.municipio, role: f.esfera === "municipal" ? "beneficiary" : "seat",
      who: f.nome, basis: sphereLabels[f.esfera] + " · valor recebido", value: f.valor,
    }));
}

function Recipients({ item }: { item: EmendaNacional }) {
  const detail = useQuery({ queryKey: ["emenda-nacional", item.codigoEmenda], queryFn: () => api.nacional(item.codigoEmenda) });
  return (
    <>
      <QueryState loading={detail.isLoading} error={detail.isError} retry={() => void detail.refetch()} />
      {detail.data && (
        <PlacesMap
          year={item.ano}
          places={recipientPlaces(detail.data)}
          note={`Valor recebido pelos favorecidos da Paraíba em todos os meses disponíveis. A emenda inteira, em todas as UFs, tem ${formatBRL(item.valorEmpenhadoTotal)} empenhados.`}
        />
      )}
    </>
  );
}

export default function NationalAmendments() {
  const [search, setSearch] = useSearchParams();
  const ano = readYear(search.get("ano"));
  const [open, setOpen] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["emendas-nacionais", ano], queryFn: () => api.nacionais(ano) });
  const data = query.data;
  return (
    <div className="page-stack">
      <PageHeading
        title="Emendas nacionais com recurso na Paraíba."
        scope={`Federal · Várias UFs · Exercício ${ano}`}
        description="Emendas de comissão e outras aplicadas em vários estados. Parte do dinheiro chegou a prefeituras e ao governo da Paraíba."
        actions={
          <label className="field">
            Exercício
            <select aria-label="Exercício das emendas nacionais" value={ano} onChange={(e) => setSearch({ ano: e.target.value }, { replace: true })}>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
        }
      />
      <OngoingYearNotice year={ano} />
      <div className="notice">
        Estas emendas não entram nos totais da Paraíba. O valor delas cobre todos os estados, e a CGU não
        informa quanto cabe a cada um. A parte da Paraíba aqui é o que prefeituras, fundos municipais e o
        governo do Estado receberam, segundo o arquivo aberto de favorecidos. Entidades privadas com sede
        na Paraíba aparecem à parte, porque a sede não indica onde o recurso foi aplicado.
      </div>
      <QueryState
        loading={query.isLoading}
        error={query.isError}
        retry={() => void query.refetch()}
        empty={data?.totalEmendas === 0 ? "Nenhuma emenda nacional com recurso recebido por entes da Paraíba neste exercício." : undefined}
      />
      {data && data.totalEmendas > 0 && (
        <>
          <div className="metrics">
            <Metric icon="paid" label="Recebido por entes da PB" value={formatBRLCompact(data.recebidoEntes)} context="Prefeituras, fundos municipais e Estado" />
            <Metric icon="amendments" label="Emendas nacionais" value={formatInt(data.totalEmendas)} context="Com pelo menos um ente da PB entre os favorecidos" />
            <Metric icon="info" label="Recebido por privados" value={formatBRLCompact(data.recebidoPrivados)} context="Com sede na PB · fora do total" />
          </div>
          <section className="panel" aria-label="Emendas nacionais">
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>EMENDA / ANO</th>
                    <th>AUTOR</th>
                    <th>FUNÇÃO</th>
                    <th>RECEBIDO NA PB</th>
                    <th>EMENDA INTEIRA</th>
                    <th><span className="sr-only">Favorecidos</span></th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <Fragment key={item.codigoEmenda}>
                      <tr>
                        <td>
                          {(item.numeroEmenda ?? item.codigoEmenda) + " / " + item.ano}
                          <small>{item.tipoEmenda ?? "Modalidade não informada"} · {item.codigoEmenda}</small>
                        </td>
                        <td>{item.nomeAutor ?? "Não informado"}</td>
                        <td>{item.funcoes || "Não informada"}<small>{item.localidades}</small></td>
                        <td>
                          {formatBRL(item.recebidoEntes)}
                          <small>{item.municipios === 1 ? "1 município" : formatInt(item.municipios) + " municípios"}</small>
                        </td>
                        <td>{formatBRL(item.valorEmpenhadoTotal)}<small>Empenhado em todas as UFs</small></td>
                        <td>
                          <button
                            className="text-button"
                            aria-expanded={open === item.codigoEmenda}
                            onClick={() => setOpen(open === item.codigoEmenda ? null : item.codigoEmenda)}
                          >
                            {open === item.codigoEmenda ? "Ocultar" : "Ver favorecidos"}
                          </button>
                        </td>
                      </tr>
                      {open === item.codigoEmenda && (
                        <tr>
                          <td colSpan={6}><Recipients item={item} /></td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      <div className="notice">
        Fonte: Portal da Transparência (CGU) · arquivos abertos de emendas e de favorecidos · Exercício {ano}.
        Valor recebido corresponde a pagamentos, não a empenhos.
      </div>
    </div>
  );
}
