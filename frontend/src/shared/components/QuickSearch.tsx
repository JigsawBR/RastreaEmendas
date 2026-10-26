import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { loadGeography } from "../../features/territory/api";
import type { AmendmentSource } from "../lib/sources";
import { Icon } from "./Icon";

type Field = "parlamentar" | "municipio";
const placeholders: Record<Field, string> = {
  parlamentar: "Ex.: Ruy Carneiro",
  municipio: "Ex.: Cajazeiras",
};

/** Overview entry point: one field, straight into the filtered query. */
export default function QuickSearch({ year, source }: { year: number; source: AmendmentSource }) {
  const navigate = useNavigate();
  const [field, setField] = useState<Field>("parlamentar");
  const [text, setText] = useState("");
  // Official names: the state filter only accepts them, and they help both origins.
  const geography = useQuery({ queryKey: ["pb-geography"], queryFn: loadGeography, staleTime: Infinity, enabled: field === "municipio" });
  const municipalities = useMemo(
    () => (geography.data?.features ?? []).map((f) => f.properties.name).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [geography.data],
  );
  const base = `/emendas?origem=${source}&ano=${year}`;
  return (
    <section className="panel quick-search" aria-labelledby="quick-search-title">
      <div className="quick-search-title">
        <span className="cta-icon"><Icon name="search" size={22} /></span>
        <div>
          <h2 id="quick-search-title">Encontre uma emenda</h2>
          <p>Busque por parlamentar ou município e acompanhe os documentos de cada fase.</p>
        </div>
      </div>
      <form
        className="quick-search-form"
        onSubmit={(event) => {
          event.preventDefault();
          navigate(text.trim() ? `${base}&${field}=${encodeURIComponent(text.trim())}` : base);
        }}
      >
        <label className="field">
          Buscar por
          <select value={field} onChange={(event) => setField(event.target.value as Field)}>
            <option value="parlamentar">Parlamentar</option>
            <option value="municipio">Município</option>
          </select>
        </label>
        <label className="field quick-search-text">
          {field === "parlamentar" ? "Nome do parlamentar" : "Nome do município"}
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={placeholders[field]}
            list={field === "municipio" ? "quick-search-municipalities" : undefined}
          />
          {field === "municipio" && (
            <datalist id="quick-search-municipalities">
              {municipalities.map((name) => <option key={name} value={name} />)}
            </datalist>
          )}
        </label>
        <button className="button" type="submit">Buscar</button>
      </form>
      <p className="quick-search-links small">
        <Link to={base}>Ver todas as emendas de {year}</Link>
        <span aria-hidden="true">·</span>
        <Link to="/sobre-os-dados">Como interpretar os dados</Link>
      </p>
    </section>
  );
}
