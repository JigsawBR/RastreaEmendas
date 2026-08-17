import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { formatBRLCompact, formatInt } from "../lib/format";

const ANOS = [null, 2026, 2025, 2024] as const;
const PAGE_SIZE = 20;

export default function EmendasList() {
  const [ano, setAno] = useState<number | null>(2024);
  const [parlamentar, setParlamentar] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [funcao, setFuncao] = useState("");
  const [page, setPage] = useState(0);

  const params = {
    ano: ano ?? undefined,
    parlamentar: parlamentar || undefined,
    municipio: municipio || undefined,
    funcao: funcao || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["emendas", params],
    queryFn: () => api.emendas(params),
  });

  const exportUrl = api.exportEmendasUrl({
    ano: params.ano, parlamentar: params.parlamentar,
    municipio: params.municipio, funcao: params.funcao,
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Emendas</h1>
          <p className="text-slate-600 mt-1">
            {data ? `${formatInt(data.total)} emendas` : "..."}
          </p>
        </div>
        <a href={exportUrl}
          className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-md">
          Exportar CSV
        </a>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <select
          value={ano ?? ""}
          onChange={(e) => { setAno(e.target.value ? Number(e.target.value) : null); setPage(0); }}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
        >
          {ANOS.map((y) => <option key={String(y)} value={y ?? ""}>{y ?? "Todos os anos"}</option>)}
        </select>
        <input
          placeholder="Parlamentar"
          value={parlamentar}
          onChange={(e) => { setParlamentar(e.target.value); setPage(0); }}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm"
        />
        <input
          placeholder="Municipio / Localidade"
          value={municipio}
          onChange={(e) => { setMunicipio(e.target.value); setPage(0); }}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm"
        />
        <input
          placeholder="Funcao"
          value={funcao}
          onChange={(e) => { setFuncao(e.target.value); setPage(0); }}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm"
        />
        <button
          onClick={() => { setParlamentar(""); setMunicipio(""); setFuncao(""); setPage(0); }}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm hover:bg-slate-50"
        >
          Limpar filtros
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Codigo</th>
              <th className="px-4 py-2 font-medium">Ano</th>
              <th className="px-4 py-2 font-medium">Parlamentar</th>
              <th className="px-4 py-2 font-medium">Localidade(s)</th>
              <th className="px-4 py-2 font-medium">Funcao</th>
              <th className="px-4 py-2 font-medium text-right">Empenhado</th>
              <th className="px-4 py-2 font-medium text-right">Pago</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Carregando...</td></tr>
            )}
            {data?.items.map((e) => (
              <tr key={e.codigoEmenda} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2 font-mono text-xs">
                  <Link className="text-emerald-700 hover:underline" to={`/emendas/${e.codigoEmenda}`}>
                    {e.codigoEmenda}
                  </Link>
                </td>
                <td className="px-4 py-2">{e.ano}</td>
                <td className="px-4 py-2">{e.nomeAutor ?? "—"}</td>
                <td className="px-4 py-2 text-xs">{e.localidades.join(", ")}</td>
                <td className="px-4 py-2 text-xs">{e.funcoes.join(", ")}</td>
                <td className="px-4 py-2 text-right">{formatBRLCompact(e.valorEmpenhado)}</td>
                <td className="px-4 py-2 text-right">{formatBRLCompact(e.valorPago)}</td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Sem resultados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {data && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-slate-500">Pagina {page + 1} de {totalPages}</span>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-3 py-1 border border-slate-300 rounded-md disabled:opacity-50"
            >Anterior</button>
            <button
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 border border-slate-300 rounded-md disabled:opacity-50"
            >Proxima</button>
          </div>
        </div>
      )}
    </div>
  );
}
