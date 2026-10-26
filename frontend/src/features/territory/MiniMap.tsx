import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { loadGeography, municipalityMapData } from "./api";
import { indicators, paths, rampStep } from "./map-model";
import { classLabels, classOf, quantileBreaks } from "./scale";
import { formatBRLCompact } from "../../shared/lib/format";

/**
 * Compact, non-interactive version of the municipality map for the overview.
 * The three largest values are listed as text, so the picture is not the only
 * way to read it; the full map is one link away.
 */
export default function MiniMap({ year, indicator: key }: { year: number; indicator: keyof typeof indicators }) {
  const indicator = indicators[key];
  const geography = useQuery({ queryKey: ["pb-geography"], queryFn: loadGeography, staleTime: Infinity });
  const data = useQuery({ queryKey: ["municipality-map", year], queryFn: () => municipalityMapData(year) });
  const model = useMemo(() => {
    if (!geography.data || !data.data) return null;
    const values = new Map(data.data.items.map((item) => [item.codigoIbge, indicator.value(item)]));
    const breaks = quantileBreaks([...values.values()]);
    const classes = classLabels([...values.values()], breaks).length;
    const top = [...data.data.items].sort((a, b) => indicator.value(b) - indicator.value(a))
      .filter((item) => indicator.value(item) > 0).slice(0, 3);
    return {
      shapes: paths(geography.data).map((shape) => {
        const cls = classOf(values.get(shape.code) ?? 0, breaks);
        return { ...shape, className: cls ? `map-${indicator.ramp}-${rampStep(cls, classes)}` : "map-none" };
      }),
      top,
      located: [...values.values()].filter((value) => value > 0).length,
    };
  }, [geography.data, data.data, indicator]);
  if (geography.isError || data.isError) return <p className="muted small">Mapa indisponível no momento.</p>;
  if (!model) return <div className="mini-map-placeholder" role="status">Carregando o mapa…</div>;
  return (
    <div className="mini-map">
      <svg viewBox="0 0 1000 540" role="img" aria-label={`Mapa da Paraíba: ${indicator.label}, ${year}`}>
        {model.shapes.map((shape) => <path key={shape.code} d={shape.path} fillRule="evenodd" className={`mini-map-area ${shape.className}`} />)}
      </svg>
      <div className="mini-map-scale" aria-hidden="true">
        <span>menor</span>
        {[1, 2, 3, 4, 5].map((step) => <i key={step} className={`map-${indicator.ramp}-${step}`} />)}
        <span>maior</span>
        <i className="map-none" /><span>sem valor</span>
      </div>
      {model.top.length > 0 && <p className="mini-map-top-title muted small">Maiores valores</p>}
      {model.top.length > 0 && (
        <ol className="mini-map-top" aria-label="Maiores valores">
          {model.top.map((item) => (
            <li key={item.codigoIbge}><span>{item.municipio}</span><strong>{formatBRLCompact(indicator.value(item))}</strong></li>
          ))}
        </ol>
      )}
      <p className="muted small">{model.located} municípios com valor · {indicator.label}</p>
      <Link to={`/municipios?ano=${year}`}>Abrir o mapa completo →</Link>
    </div>
  );
}
