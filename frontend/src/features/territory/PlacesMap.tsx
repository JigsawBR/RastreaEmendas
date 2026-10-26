import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { loadGeography } from "./api";
import { paths } from "./map-model";
import { formatBRL } from "../../shared/lib/format";

/**
 * "beneficiary": the money is for this city (CGU locality, city hall transfer).
 * "seat": only where the recipient is registered; it does not make the city a
 * beneficiary, so it is drawn differently and said so in the legend.
 */
export type Place = { code: string; name?: string | null; role: "beneficiary" | "seat"; who: string; basis: string; value?: number | null };
export type OutsidePlace = { who: string; where: string; value?: number | null };

const roleLabels = { beneficiary: "Município beneficiado", seat: "Sede do favorecido" };
const rank = (role: Place["role"] | undefined) => (role === "beneficiary" ? 1 : 0);

export default function PlacesMap({ places, outside = [], year, note }: {
  places: Place[];
  outside?: OutsidePlace[];
  year: number;
  note?: string;
}) {
  const geography = useQuery({ queryKey: ["pb-geography"], queryFn: loadGeography, staleTime: Infinity });
  const shapes = useMemo(() => (geography.data ? paths(geography.data) : []), [geography.data]);
  // A city that is both a beneficiary and a seat is shown as beneficiary.
  const roleByCode = new Map<string, Place["role"]>();
  for (const place of places)
    if (roleByCode.get(place.code) !== "beneficiary") roleByCode.set(place.code, place.role);
  const names = new Map(shapes.map((shape) => [shape.code, shape.name]));
  const marked = shapes.filter((shape) => roleByCode.has(shape.code));
  if (!places.length && !outside.length)
    return <p className="muted small">Nenhum município ou favorecido localizado nas fontes carregadas para esta emenda.</p>;
  return (
    <div className="places-map">
      {places.length > 0 && (geography.isError
        ? <p className="muted small">Mapa indisponível no momento; os municípios estão listados abaixo.</p>
        : <figure className="places-map-figure">
            <svg viewBox="0 0 1000 540" role="img" aria-label={`Mapa da Paraíba com ${roleByCode.size} município(s) desta emenda`}>
              {shapes.map((shape) => (
                <path key={shape.code} d={shape.path} fillRule="evenodd"
                  className={`places-area places-${roleByCode.get(shape.code) ?? "none"}`} />
              ))}
              {/* Markers keep small cities visible; beneficiaries are drawn last, on top. */}
              {[...marked].sort((a, b) => rank(roleByCode.get(a.code)) - rank(roleByCode.get(b.code))).map((shape) => (
                <circle key={shape.code} cx={shape.cx} cy={shape.cy} r={11}
                  className={`places-marker places-marker-${roleByCode.get(shape.code)}`}>
                  <title>{shape.name} · {roleLabels[roleByCode.get(shape.code)!]}</title>
                </circle>
              ))}
            </svg>
            <figcaption className="places-legend">
              <span><i className="places-swatch places-beneficiary" aria-hidden="true" />{roleLabels.beneficiary}</span>
              <span><i className="places-swatch places-seat" aria-hidden="true" />{roleLabels.seat} (não indica benefício à cidade)</span>
            </figcaption>
          </figure>)}
      <div className="table-scroll">
      <table className="data-table places-table">
        <thead><tr><th>Município</th><th>Papel</th><th>Quem / fonte</th><th>Valor</th></tr></thead>
        <tbody>
          {[...places].sort((a, b) => (a.role === b.role ? (b.value ?? 0) - (a.value ?? 0) : a.role === "beneficiary" ? -1 : 1)).map((place, i) => (
            <tr key={i}>
              <td>
                <Link to={`/municipios?ano=${year}`}>{names.get(place.code) ?? place.name ?? place.code}</Link>
              </td>
              <td><i className={`places-swatch places-${place.role}`} aria-hidden="true" /> {roleLabels[place.role]}</td>
              <td>{place.who}<small>{place.basis}</small></td>
              <td className="amount">{place.value == null ? "—" : formatBRL(place.value)}</td>
            </tr>
          ))}
          {outside.map((place, i) => (
            <tr key={"out-" + i}>
              <td>{place.where}</td>
              <td>Fora da Paraíba</td>
              <td>{place.who}<small>Sede do favorecido</small></td>
              <td className="amount">{place.value == null ? "—" : formatBRL(place.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {note && <p className="muted small">{note}</p>}
    </div>
  );
}
