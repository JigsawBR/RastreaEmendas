import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../lib/api";
import { formatBRL, formatInt } from "../lib/format";

const ANOS = [2026, 2025, 2024];

export default function Municipios() {
  const [ano, setAno] = useState<number>(2024);
  const { data, isLoading } = useQuery({
    queryKey: ["municipios", ano],
    queryFn: () => api.municipios(ano),
  });

  const maxValor = data
    ? Math.max(
        ...data.items.map((i) =>
          Math.max(i.valorEmpenhado, i.despesaEmpenhado, i.transferegovValor),
        ),
        1,
      )
    : 1;

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

      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-600 text-left">
            <tr className="text-[10px] uppercase tracking-wide">
              <th className="px-3 pt-2"></th>
              <th colSpan={3} className="px-3 pt-2 border-l border-slate-200">Emendas (localidade do gasto)</th>
              <th colSpan={3} className="px-3 pt-2 border-l border-slate-200">Despesa mensal (execucao)</th>
              <th colSpan={2} className="px-3 pt-2 border-l border-slate-200">Transf. especiais (Transferegov)</th>
              <th className="px-3 pt-2"></th>
            </tr>
            <tr>
              <th className="px-3 py-2 font-medium">Localidade</th>
              <th className="px-3 py-2 font-medium text-right border-l border-slate-200">Emendas</th>
              <th className="px-3 py-2 font-medium text-right">Empenhado</th>
              <th className="px-3 py-2 font-medium text-right">Pago</th>
              <th className="px-3 py-2 font-medium text-right border-l border-slate-200">Autores</th>
              <th className="px-3 py-2 font-medium text-right">Empenhado</th>
              <th className="px-3 py-2 font-medium text-right">Pago</th>
              <th className="px-3 py-2 font-medium text-right border-l border-slate-200">Planos</th>
              <th className="px-3 py-2 font-medium text-right">Valor</th>
              <th className="px-3 py-2 font-medium w-28">Volume</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-slate-500">Carregando...</td></tr>
            )}
            {data?.items.map((m) => (
              <tr key={m.localidade} className="border-t border-slate-100">
                <td className="px-3 py-2 whitespace-nowrap">{m.localidade}</td>
                <td className="px-3 py-2 text-right border-l border-slate-100">
                  {m.quantidadeEmendas > 0 ? formatInt(m.quantidadeEmendas) : "—"}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {m.valorEmpenhado > 0 ? formatBRL(m.valorEmpenhado) : "—"}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {m.valorPago > 0 ? formatBRL(m.valorPago) : "—"}
                </td>
                <td className="px-3 py-2 text-right border-l border-slate-100">
                  {m.autoresDespesa > 0 ? formatInt(m.autoresDespesa) : "—"}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {m.despesaEmpenhado > 0 ? formatBRL(m.despesaEmpenhado) : "—"}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {m.despesaPago > 0 ? formatBRL(m.despesaPago) : "—"}
                </td>
                <td className="px-3 py-2 text-right border-l border-slate-100">
                  {m.planosTransferegov > 0 ? formatInt(m.planosTransferegov) : "—"}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {m.transferegovValor > 0 ? formatBRL(m.transferegovValor) : "—"}
                </td>
                <td className="px-3 py-2">
                  <div className="h-2 bg-slate-100 rounded">
                    <div
                      className="h-2 bg-emerald-500 rounded"
                      style={{
                        width: `${(Math.max(m.valorEmpenhado, m.despesaEmpenhado, m.transferegovValor) / maxValor) * 100}%`,
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500 mt-3">
        "Emendas" agrega as alocacoes declaradas nas emendas (localidade do gasto).
        "Despesa mensal" agrega a execucao orcamentaria por municipio; a linha
        PARAÍBA (UF) concentra os gastos estaduais ou nao municipalizados.
        "Transf. especiais" agrega os planos de acao do Transferegov (EC 105),
        cujo beneficiario e sempre explicito. As fontes sao complementares e nao
        devem ser somadas.
      </p>
    </div>
  );
}
