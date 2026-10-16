import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { municipalityMapData } from "./api";
import type { MunicipalityMapItem } from "./api";
import { QueryState } from "../../shared/components/DesignSystem";
import { formatBRL, formatInt } from "../../shared/lib/format";

type Position = [number, number];
type Shape = { properties: { code: string; name: string }; geometry: { type: "Polygon"; coordinates: Position[][] } | { type: "MultiPolygon"; coordinates: Position[][][] } };
type Geography = { type: "FeatureCollection"; features: Shape[] };
const labels = { federal: "Federais", state: "Estaduais", both: "Federais e estaduais", none: "Sem vínculo identificado" };
type Category = keyof typeof labels;
function category(item: MunicipalityMapItem | undefined, origin: string): Category {
  const federal = origin !== "state" && !!item?.federal.comRecursos;
  const state = origin !== "federal" && (item?.estadual.quantidade ?? 0) > 0;
  return federal && state ? "both" : federal ? "federal" : state ? "state" : "none";
}
async function loadGeography(): Promise<Geography> {
  const response = await fetch("/maps/paraiba.geojson");
  if (!response.ok) throw new Error("Malha indisponível");
  const data = await response.json();
  if (data.type !== "FeatureCollection" || data.features?.length !== 223) throw new Error("Malha incompleta");
  return data;
}
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
  const [origin, setOrigin] = useState("all");
  const [selectedCode, setSelectedCode] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const geography = useQuery({ queryKey: ["pb-geography"], queryFn: loadGeography, staleTime: Infinity });
  const data = useQuery({ queryKey: ["municipality-map", year], queryFn: () => municipalityMapData(year) });
  const shapes = useMemo(() => geography.data ? paths(geography.data) : [], [geography.data]);
  const index = useMemo(() => new Map(data.data?.items.map(item => [item.codigoIbge, item]) ?? []), [data.data]);
  const selected = index.get(selectedCode);
  const active = index.get(hovered ?? selectedCode);
  const counts = { federal: 0, state: 0, both: 0, none: 0 };
  for (const row of index.values()) counts[category(row, origin)]++;
  function select(code: string) { setSelectedCode(code); setHovered(null); setExpanded(false); }
  return <section className="panel municipality-map-panel" aria-labelledby="municipality-map-title">
    <div className="municipality-map-heading">
      <div><span className="eyebrow">TERRITÓRIO · EXERCÍCIO {year}</span><h2 id="municipality-map-title">As emendas no mapa da Paraíba</h2><p className="muted">Explore os 223 municípios. Selecione uma cidade para consultar suas fontes e emendas vinculadas.</p></div>
      <label className="field">Origem no mapa<select value={origin} onChange={event => setOrigin(event.target.value)}>
        <option value="all">Federais e estaduais</option><option value="federal">Apenas federais</option><option value="state">Apenas estaduais</option>
      </select></label>
    </div>
    <QueryState loading={geography.isLoading || data.isLoading} error={geography.isError || data.isError} retry={() => { void geography.refetch(); void data.refetch(); }} />
    {geography.data && data.data && <>
      <div className="map-legend" aria-label="Legenda do mapa">{(Object.keys(labels) as Category[]).map(key => <span key={key}><i className={`map-swatch map-${key}`} aria-hidden="true" />{labels[key]} <strong>{formatInt(counts[key])}</strong></span>)}</div>
      <div className="municipality-map-layout">
        <div className="municipality-map-canvas">
          <svg viewBox="0 0 1000 540" role="group" aria-label={`Mapa dos 223 municípios da Paraíba em ${year}`}>
            <title>Municípios da Paraíba: vínculos federais e estaduais</title>
            {shapes.map(shape => <path key={shape.code} d={shape.path} fillRule="evenodd" className={`municipality-area map-${category(index.get(shape.code), origin)}${selectedCode === shape.code ? " is-selected" : ""}`}
              role="button" tabIndex={0} aria-label={`${shape.name} — ${labels[category(index.get(shape.code), origin)]}`} aria-pressed={selectedCode === shape.code}
              onClick={() => select(shape.code)} onMouseEnter={() => setHovered(shape.code)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(shape.code)} onBlur={() => setHovered(null)}
              onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(shape.code); } }}>
              <title>{shape.name} · {labels[category(index.get(shape.code), origin)]}</title>
            </path>)}
          </svg>
          <div className="map-active-label" aria-live="polite">{active ? <><strong>{active.municipio}</strong><span>{labels[category(active, origin)]}</span></> : <span>Passe sobre o mapa ou selecione um município</span>}</div>
          <p className="muted small map-attribution">Malha municipal: <a href="https://servicodados.ibge.gov.br/api/docs/malhas?versao=3" target="_blank" rel="noreferrer">IBGE</a> · limites simplificados</p>
        </div>
        <aside className="municipality-map-detail" aria-label="Detalhes do município">
          <label className="field">Selecionar município<select value={selectedCode} onChange={event => select(event.target.value)}>
            <option value="">Escolha um município</option>{[...index.values()].sort((a, b) => a.municipio.localeCompare(b.municipio, "pt-BR")).map(item => <option key={item.codigoIbge} value={item.codigoIbge}>{item.municipio}</option>)}
          </select></label>
          {!selected ? <div className="map-empty-selection"><h3>De cidade em cidade</h3><p>As cores mostram onde há recursos federais ou vínculos estaduais identificados na base. Clique no mapa ou use a lista acima.</p></div> : <>
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
                <p>{selected.estadual.quantidade} {selected.estadual.quantidade === 1 ? "emenda com vínculo territorial" : "emendas com vínculo territorial"}</p>
                <p className="muted small">Município informado no empenho ou no convenente. O vínculo não atribui todo o valor da emenda a esta cidade nem comprova pagamento.</p>
                <ul className="map-amendment-links">{selected.estadual.emendas.slice(0, expanded ? undefined : 5).map(item => <li key={`${item.ano}:${item.numero}`}><Link to={`/emendas-estaduais/${item.ano}/${encodeURIComponent(item.numero)}`}>Emenda estadual {item.numero}</Link><small>{item.fontes.join(" · ")}</small></li>)}</ul>
                {selected.estadual.emendas.length > 5 && <button className="button secondary" onClick={() => setExpanded(!expanded)}>{expanded ? "Mostrar menos" : "Ver todas as emendas vinculadas"}</button>}
              </> : <p className="muted small">Nenhum vínculo estadual com município explícito identificado na base carregada.</p>}
            </div>
          </>}
        </aside>
      </div>
      <p className="notice">Destaque no mapa indica recurso ou destinação identificada, sem certificar pagamento ou entrega. Valores das fontes federais são complementares e não devem ser somados. Cinza indica vínculo não identificado no filtro atual, não ausência de recursos.</p>
      <p className="muted small">Fora da distribuição municipal: {data.data.semMunicipio.alocacoesFederais} alocações federais e {data.data.semMunicipio.emendasEstaduais} emendas estaduais sem município identificado nas fontes utilizadas. Contratos com endereço de fornecedor e vínculos candidatos não municipalizam recursos.</p>
      {data.data.coberturaEstadual.length === 0 && <p className="notice">Convênios estaduais ainda não carregados para este exercício. O mapa estadual considera apenas os empenhos disponíveis com município explícito.</p>}
    </>}
  </section>;
}
