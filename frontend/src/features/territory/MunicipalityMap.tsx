import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { loadGeography, municipalityMapData } from "./api";
import type { Geography, MunicipalityMapItem } from "./api";
import { classLabels, classOf, quantileBreaks } from "./scale";
import { QueryState } from "../../shared/components/DesignSystem";
import { formatBRL, formatBRLCompact, formatInt } from "../../shared/lib/format";

const labels = { federal: "Federais", state: "Estaduais", both: "Federais e estaduais", none: "Sem vínculo identificado" };
type Category = keyof typeof labels;
function category(item: MunicipalityMapItem | undefined): Category {
  const federal = !!item?.federal.comRecursos;
  const state = (item?.estadual.quantidade ?? 0) > 0;
  return federal && state ? "both" : federal ? "federal" : state ? "state" : "none";
}

// One source per indicator: federal sources are complementary and must not be
// summed, and a planned value is not execution.
type Indicator = { label: string; unit: string; ramp: "federal" | "state"; value: (item: MunicipalityMapItem) => number; note: string };
const indicators: Record<string, Indicator> = {
  estadual: {
    label: "Estadual · transferido ao município", unit: "transferidos", ramp: "state",
    value: (item) => item.estadual.valorTransferido,
    note: "Empenho líquido das notas de transferência à prefeitura ou a fundo municipal (CODATA). Recursos a entidades sediadas na cidade não entram.",
  },
  planos: {
    label: "Federal · planos especiais (previsto)", unit: "previstos", ramp: "federal",
    value: (item) => item.federal.valorPlanos,
    note: "Valor previsto nos planos de ação das transferências especiais (Transferegov). É previsão, não execução.",
  },
  alocacoes: {
    label: "Federal · alocações por município", unit: "empenhados", ramp: "federal",
    value: (item) => item.federal.empenhado,
    note: "Empenhado nas alocações da CGU que informam o município. A maior parte do valor federal está registrada como PARAÍBA (UF) e não aparece aqui.",
  },
  despesa: {
    label: "Federal · execução mensal", unit: "empenhados", ramp: "federal",
    value: (item) => item.federal.despesaEmpenhado,
    note: "Despesa mensal dos arquivos abertos com autor de emenda, recortada pelo ano do gasto.",
  },
};
const PRESENCE = "presenca";
const RAMP_STEPS = 5;
// Fewer classes (repeated values) still span the whole ramp, light to dark.
const rampStep = (cls: number, classes: number) =>
  classes <= 1 ? RAMP_STEPS : 1 + Math.round(((cls - 1) * (RAMP_STEPS - 1)) / (classes - 1));

function paths(data: Geography) {
  const polygons = data.features.map(feature => ({ feature, polygons: feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates }));
  const positions = polygons.flatMap(shape => shape.polygons.flat(2));
  const longitude = positions.map(point => point[0]);
  const latitude = positions.map(point => -point[1]);
  const left = Math.min(...longitude), top = Math.min(...latitude);
  const width = Math.max(...longitude) - left, height = Math.max(...latitude) - top;
  const scale = Math.min(960 / width, 500 / height);
  const dx = (1000 - width * scale) / 2, dy = (540 - height * scale) / 2;
  return polygons.map(({ feature, polygons: rings }) => ({
    code: feature.properties.code, name: feature.properties.name,
    path: rings.map(polygon => polygon.map(ring => ring.map(([x, y], i) => `${i ? "L" : "M"}${((x - left) * scale + dx).toFixed(2)},${((-y - top) * scale + dy).toFixed(2)}`).join(" ") + " Z").join(" ")).join(" "),
  }));
}

export default function MunicipalityMap({ year }: { year: number }) {
  const [mode, setMode] = useState("estadual");
  const [selectedCode, setSelectedCode] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const geography = useQuery({ queryKey: ["pb-geography"], queryFn: loadGeography, staleTime: Infinity });
  const data = useQuery({ queryKey: ["municipality-map", year], queryFn: () => municipalityMapData(year) });
  const shapes = useMemo(() => geography.data ? paths(geography.data) : [], [geography.data]);
  const index = useMemo(() => new Map(data.data?.items.map(item => [item.codigoIbge, item]) ?? []), [data.data]);
  const indicator = indicators[mode];
  const scale = useMemo(() => {
    if (!indicator) return null;
    const values = [...index.values()].map(indicator.value);
    const breaks = quantileBreaks(values);
    return { breaks, labels: classLabels(values, breaks) };
  }, [index, indicator]);
  const selected = index.get(selectedCode);
  const active = index.get(hovered ?? selectedCode);

  // Class name and accessible description of a municipality in the current mode.
  function describe(item: MunicipalityMapItem | undefined) {
    if (!indicator || !scale) {
      const cat = category(item);
      return { className: `map-${cat}`, text: labels[cat], cls: 0 };
    }
    const value = item ? indicator.value(item) : 0;
    const cls = classOf(value, scale.breaks);
    return cls === 0
      ? { className: "map-none", text: "Sem valor neste indicador", cls }
      : { className: `map-${indicator.ramp}-${rampStep(cls, scale.labels.length)}`, text: `${formatBRLCompact(value)} ${indicator.unit}`, cls };
  }
  const legend = (() => {
    const all = [...index.values()];
    if (!indicator || !scale) {
      const counts = { federal: 0, state: 0, both: 0, none: 0 };
      for (const row of all) counts[category(row)]++;
      return (Object.keys(labels) as Category[]).map(key => ({ key, className: `map-${key}`, label: labels[key], count: counts[key] }));
    }
    const counts = new Array(scale.labels.length + 1).fill(0);
    for (const row of all) counts[describe(row).cls]++;
    return [
      ...scale.labels.map((label, i) => ({ key: String(i + 1), className: `map-${indicator.ramp}-${rampStep(i + 1, scale.labels.length)}`, label, count: counts[i + 1] })),
      { key: "0", className: "map-none", label: "Sem valor", count: counts[0] },
    ];
  })();
  function select(code: string) { setSelectedCode(code); setHovered(null); setExpanded(false); }
  return <section className="panel municipality-map-panel" aria-labelledby="municipality-map-title">
    <div className="municipality-map-heading">
      <div><span className="eyebrow">TERRITÓRIO · EXERCÍCIO {year}</span><h2 id="municipality-map-title">As emendas no mapa da Paraíba</h2><p className="muted">Explore os 223 municípios. Quanto mais escura a cor, maior o valor no indicador escolhido.</p></div>
      <label className="field">Indicador no mapa<select value={mode} onChange={event => setMode(event.target.value)}>
        {Object.entries(indicators).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
        <option value={PRESENCE}>Presença (federal e estadual)</option>
      </select></label>
    </div>
    <QueryState loading={geography.isLoading || data.isLoading} error={geography.isError || data.isError} retry={() => { void geography.refetch(); void data.refetch(); }} />
    {geography.data && data.data && <>
      <div className="map-legend" aria-label="Legenda do mapa">
        {indicator && <span className="map-legend-title">Faixas com quantidade semelhante de municípios:</span>}
        {legend.map(entry => <span key={entry.key}><i className={`map-swatch ${entry.className}`} aria-hidden="true" />{entry.label} <strong>{formatInt(entry.count)}</strong></span>)}
      </div>
      {indicator && <p className="muted small map-indicator-note">{indicator.note}</p>}
      <div className="municipality-map-layout">
        <div className="municipality-map-canvas">
          <svg viewBox="0 0 1000 540" role="group" aria-label={`Mapa dos 223 municípios da Paraíba em ${year}`}>
            <title>Municípios da Paraíba: {indicator ? indicator.label : "vínculos federais e estaduais"}</title>
            {shapes.map(shape => {
              const view = describe(index.get(shape.code));
              return <path key={shape.code} d={shape.path} fillRule="evenodd" className={`municipality-area ${view.className}${selectedCode === shape.code ? " is-selected" : ""}`}
                role="button" tabIndex={0} aria-label={`${shape.name} — ${view.text}`} aria-pressed={selectedCode === shape.code}
                onClick={() => select(shape.code)} onMouseEnter={() => setHovered(shape.code)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(shape.code)} onBlur={() => setHovered(null)}
                onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(shape.code); } }}>
                <title>{shape.name} · {view.text}</title>
              </path>;
            })}
          </svg>
          <div className="map-active-label" aria-live="polite">{active ? <><strong>{active.municipio}</strong><span>{describe(active).text}</span></> : <span>Passe sobre o mapa ou selecione um município</span>}</div>
          <p className="muted small map-attribution">Malha municipal: <a href="https://servicodados.ibge.gov.br/api/docs/malhas?versao=3" target="_blank" rel="noreferrer">IBGE</a> · limites simplificados</p>
        </div>
        <aside className="municipality-map-detail" aria-label="Detalhes do município">
          <label className="field">Selecionar município<select value={selectedCode} onChange={event => select(event.target.value)}>
            <option value="">Escolha um município</option>{[...index.values()].sort((a, b) => a.municipio.localeCompare(b.municipio, "pt-BR")).map(item => <option key={item.codigoIbge} value={item.codigoIbge}>{item.municipio}</option>)}
          </select></label>
          {!selected ? <div className="map-empty-selection"><h3>De cidade em cidade</h3><p>A cor mostra o valor de cada município no indicador escolhido. Clique no mapa ou use a lista acima.</p></div> : <>
            <h3>{selected.municipio}</h3><p className="muted small">Código IBGE {selected.codigoIbge}</p>
            <div className="map-origin-card"><h4><i className="map-swatch map-federal" aria-hidden="true" /> Emendas federais</h4>
              {selected.federal.comRecursos ? <>
                <p>{selected.federal.emendas} {selected.federal.emendas === 1 ? "emenda com localidade explícita" : "emendas com localidade explícita"}</p>
                <dl><div><dt>Empenhado nas alocações</dt><dd>{formatBRL(selected.federal.empenhado)}</dd></div><div><dt>Pago nas alocações</dt><dd>{formatBRL(selected.federal.pago)}</dd></div></dl>
                {selected.federal.planos > 0 && <p>{selected.federal.planos} planos especiais · {formatBRL(selected.federal.valorPlanos)} previstos nos planos</p>}
                {(selected.federal.despesaEmpenhado !== 0 || selected.federal.despesaPago !== 0) && <p className="small">Execução mensal no ano: {formatBRL(selected.federal.despesaEmpenhado)} empenhados · {formatBRL(selected.federal.despesaPago)} pagos. Recorte por ano do gasto.</p>}
                <Link to={`/emendas?origem=federal&ano=${year}&municipio=${encodeURIComponent(selected.municipio)}`}>Consultar emendas por localidade →</Link>
              </> : <p className="muted small">Nenhum valor federal positivo identificado nas fontes carregadas deste exercício.</p>}
            </div>
            <div className="map-origin-card"><h4><i className="map-swatch map-state" aria-hidden="true" /> Emendas estaduais</h4>
              {selected.estadual.quantidade > 0 ? <>
                <p>{selected.estadual.quantidade} {selected.estadual.quantidade === 1 ? "emenda transferida ao município" : "emendas transferidas ao município"}</p>
                {selected.estadual.valorTransferido > 0 && <dl><div><dt>Empenho transferido</dt><dd>{formatBRL(selected.estadual.valorTransferido)}</dd></div></dl>}
                <p className="muted small">Empenho transferido à prefeitura ou a fundo municipal. Não comprova pagamento.</p>
                <ul className="map-amendment-links">{selected.estadual.emendas.slice(0, expanded ? undefined : 5).map(item => <li key={`${item.ano}:${item.numero}`}><Link to={`/emendas-estaduais/${item.ano}/${encodeURIComponent(item.numero)}`}>Emenda estadual {item.numero}</Link><small>{item.fontes.join(" · ")}</small></li>)}</ul>
                {selected.estadual.emendas.length > 5 && <button className="button secondary" onClick={() => setExpanded(!expanded)}>{expanded ? "Mostrar menos" : "Ver todas as emendas vinculadas"}</button>}
                <Link to={`/emendas?origem=estadual&ano=${year}&municipio=${encodeURIComponent(selected.municipio)}`}>Consultar emendas estaduais do município →</Link>
              </> : <p className="muted small">Nenhuma transferência estadual a este município identificada na base carregada. Recursos a entidades sediadas aqui não são atribuídos à cidade.</p>}
            </div>
          </>}
        </aside>
      </div>
      <p className="notice">A cor indica o valor registrado na fonte do indicador, sem certificar pagamento ou entrega. As fontes não são somadas entre si. Cinza indica valor não identificado nesta fonte, não ausência de recursos.</p>
      <p className="muted small">Fora da distribuição municipal: {data.data.semMunicipio.alocacoesFederais} alocações federais e {data.data.semMunicipio.emendasEstaduais} emendas estaduais sem município identificado nas fontes utilizadas. Contratos com endereço de fornecedor e vínculos candidatos não municipalizam recursos.</p>
      {data.data.coberturaEstadual.length === 0 && <p className="notice">Convênios estaduais ainda não carregados para este exercício. O mapa estadual considera apenas as transferências a municípios nos empenhos disponíveis.</p>}
    </>}
  </section>;
}
