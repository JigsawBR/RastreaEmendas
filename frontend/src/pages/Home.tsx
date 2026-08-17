import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../lib/api";
import { formatBRL, formatBRLCompact, formatInt, formatPct } from "../lib/format";

const ANOS = [2026, 2025, 2024];

export default function Home() {
  const [ano, setAno] = useState<number>(2024);
  const { data, isLoading, error } = useQuery({
    queryKey: ["resumo", ano],
    queryFn: () => api.resumo(ano),
  });

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Emendas parlamentares - Paraiba
          </h1>
          <p className="text-slate-600 mt-1">
            Visao geral consolidada do exercicio {ano}.
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

      {isLoading && <p className="text-slate-500">Carregando...</p>}
      {error && <p className="text-red-600">Erro: {String(error)}</p>}

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Kpi label="Emendas" value={formatInt(data.totalEmendas)} />
            <Kpi label="Parlamentares" value={formatInt(data.totalParlamentares)} />
            <Kpi label="Localidades" value={formatInt(data.totalLocalidades)} />
            <Kpi label="Taxa de execucao" value={formatPct(data.taxaExecucao)} accent />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="Empenhado" value={formatBRL(data.valorEmpenhado)} subtitle={formatBRLCompact(data.valorEmpenhado)} />
            <Card title="Pago" value={formatBRL(data.valorPago)} subtitle={formatBRLCompact(data.valorPago)} />
            <Card title="Liquidado" value={formatBRL(data.valorLiquidado)} subtitle={formatBRLCompact(data.valorLiquidado)} />
            <Card title="Restos a pagar inscritos" value={formatBRL(data.valorRestoInscrito)} subtitle={formatBRLCompact(data.valorRestoInscrito)} />
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${accent ? "text-emerald-700" : "text-slate-900"}`}>
        {value}
      </div>
    </div>
  );
}

function Card({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="text-xl font-semibold text-slate-900 mt-1">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{subtitle}</div>
    </div>
  );
}
