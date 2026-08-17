import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../lib/api";
import { formatBRL, formatInt, formatPct } from "../lib/format";

const ANOS = [2026, 2025, 2024];

export default function Municipios() {
  const [ano, setAno] = useState<number>(2024);
  const { data, isLoading } = useQuery({
    queryKey: ["municipios", ano],
    queryFn: () => api.municipios(ano),
  });

  const maxEmpenhado = data ? Math.max(...data.items.map((i) => i.valorEmpenhado), 1) : 1;

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Municipios / Localidades</h1>
          <p className="text-slate-600 mt-1">
            {data ? `${formatInt(data.items.length)} localidades no exercicio ${ano}` : "..."}
          </p>
        </div>
        <select
          value={ano}
          onChange={(e) => setAno(Number(e.target.value))}
          className="border border-slate-300 rounded-md px-3 py-2 bg-white text-sm"
        >
          {ANOS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Localidade</th>
              <th className="px-4 py-2 font-medium text-right">Emendas</th>
              <th className="px-4 py-2 font-medium text-right">Empenhado</th>
              <th className="px-4 py-2 font-medium text-right">Pago</th>
              <th className="px-4 py-2 font-medium text-right">% pago</th>
              <th className="px-4 py-2 font-medium w-40">Volume</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Carregando...</td></tr>
            )}
            {data?.items.map((m) => (
              <tr key={m.localidade} className="border-t border-slate-100">
                <td className="px-4 py-2">{m.localidade}</td>
                <td className="px-4 py-2 text-right">{formatInt(m.quantidadeEmendas)}</td>
                <td className="px-4 py-2 text-right">{formatBRL(m.valorEmpenhado)}</td>
                <td className="px-4 py-2 text-right">{formatBRL(m.valorPago)}</td>
                <td className="px-4 py-2 text-right">
                  {formatPct(m.valorEmpenhado > 0 ? m.valorPago / m.valorEmpenhado : 0)}
                </td>
                <td className="px-4 py-2">
                  <div className="h-2 bg-slate-100 rounded">
                    <div
                      className="h-2 bg-emerald-500 rounded"
                      style={{ width: `${(m.valorEmpenhado / maxEmpenhado) * 100}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
