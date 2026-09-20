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

  // A linha estadual nao e um municipio e vale ordens de grandeza mais que
  // qualquer um deles: deixada na tabela, ela achata todas as barras e passa a
  // impressao de que o dinheiro "sumiu" num lugar sem nome.
  const estadual = data?.items.find((i) => i.localidade.includes("(UF)"));
  const municipios = data?.items.filter((i) => !i.localidade.includes("(UF)")) ?? [];

  const maxValor = Math.max(
    ...municipios.map((i) =>
      Math.max(i.valorEmpenhado, i.despesaEmpenhado, i.transferegovValor),
    ),
    1,
  );

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Municípios</h1>
          <p className="text-slate-600 mt-1">
            {data ? `${formatInt(municipios.length)} municípios no exercício ${ano}` : "..."}
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

      {estadual && (
        <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 mb-4">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <h2 className="font-semibold text-sky-900">Gasto estadual, sem município definido</h2>
            <span className="text-lg font-semibold text-sky-900">
              {formatBRL(estadual.valorEmpenhado)} empenhados
            </span>
          </div>
          <p className="text-sm text-sky-900/80 mt-2">
            {formatInt(estadual.quantidadeEmendas)} emendas do exercício {ano} têm a
            localidade registrada como &ldquo;PARAÍBA (UF)&rdquo;. Não é dado faltante: são
            despesas executadas pelo governo estadual ou pagas a fornecedores, que não se
            atribuem a um município. Emendas de bancada, que financiam obras e serviços de
            alcance estadual, caem quase todas aqui. Para ver quem recebeu esse dinheiro,
            abra a emenda e consulte &ldquo;Para onde o dinheiro foi&rdquo;.
          </p>
        </div>
      )}

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
            {municipios.map((m) => (
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
        "Emendas" agrega as alocações declaradas nas emendas (localidade do gasto).
        "Despesa mensal" agrega a execução orçamentária por município.
        "Transf. especiais" agrega os planos de ação do Transferegov (EC 105),
        cujo beneficiário é sempre explícito. As fontes são complementares e não
        devem ser somadas.
      </p>
    </div>
  );
}
