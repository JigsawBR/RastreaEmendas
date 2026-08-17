import { Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { formatBRL, formatDate, formatPct } from "../lib/format";

export default function EmendaDetail() {
  const { codigo = "" } = useParams();
  const detalhe = useQuery({ queryKey: ["emenda", codigo], queryFn: () => api.emenda(codigo) });
  const cadeia = useQuery({ queryKey: ["cadeia", codigo], queryFn: () => api.cadeia(codigo) });
  const dist = useQuery({ queryKey: ["dist", codigo], queryFn: () => api.distribuicao(codigo) });
  const rastr = useQuery({ queryKey: ["rastr", codigo], queryFn: () => api.rastreabilidade(codigo) });

  if (detalhe.isLoading) return <p className="text-slate-500">Carregando...</p>;
  if (detalhe.error || !detalhe.data) return <p className="text-red-600">Emenda nao encontrada.</p>;

  const e = detalhe.data;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/emendas" className="text-sm text-emerald-700 hover:underline">&larr; Voltar</Link>
        <h1 className="text-2xl font-semibold mt-2">
          Emenda {e.numeroEmenda ?? "—"} <span className="text-slate-500 font-normal">({e.ano})</span>
        </h1>
        <p className="text-slate-600 mt-1">
          <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{e.codigoEmenda}</span>
          {" - "}{e.tipoEmenda ?? ""}
        </p>
        <p className="text-slate-700 mt-2"><strong>Parlamentar:</strong> {e.nomeAutor ?? "—"}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card label="Empenhado" value={formatBRL(e.valorEmpenhado)} />
        <Card label="Liquidado" value={formatBRL(e.valorLiquidado)} />
        <Card label="Pago" value={formatBRL(e.valorPago)} />
        <Card label="Restos inscritos" value={formatBRL(e.valorRestoInscrito)} />
      </div>

      {rastr.data && (
        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <h2 className="font-semibold mb-3">Rastreabilidade (RF-08)</h2>
          <div className="flex items-center gap-4 mb-3">
            <div className="text-3xl font-semibold text-emerald-700">{formatPct(rastr.data.score)}</div>
            <div className="text-sm text-slate-600">
              {rastr.data.atendidos} de {rastr.data.total} criterios atendidos
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {rastr.data.criterios.map((c) => (
              <span key={c.nome}
                className={`text-xs px-2 py-1 rounded ${c.atendido ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                {c.atendido ? "✓" : "×"} {c.nome}
              </span>
            ))}
          </div>
        </section>
      )}

      {dist.data && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h2 className="font-semibold mb-3">Distribuicao por funcao</h2>
            <table className="w-full text-sm">
              <thead className="text-slate-500 text-left"><tr>
                <th className="pb-2">Funcao</th>
                <th className="pb-2 text-right">Empenhado</th>
                <th className="pb-2 text-right">Pago</th>
              </tr></thead>
              <tbody>
                {dist.data.porFuncao.map((f) => (
                  <tr key={f.funcao} className="border-t border-slate-100">
                    <td className="py-2">{f.funcao}</td>
                    <td className="py-2 text-right">{formatBRL(f.empenhado)}</td>
                    <td className="py-2 text-right">{formatBRL(f.pago)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h2 className="font-semibold mb-3">Por orgao executor (UG)</h2>
            <table className="w-full text-sm">
              <thead className="text-slate-500 text-left"><tr>
                <th className="pb-2">Unidade gestora</th>
                <th className="pb-2 text-right">Docs</th>
                <th className="pb-2 text-right">Empenhado</th>
                <th className="pb-2 text-right">Pago</th>
              </tr></thead>
              <tbody>
                {dist.data.porOrgao.map((o) => (
                  <tr key={o.orgaoExecutor} className="border-t border-slate-100">
                    <td className="py-2">
                      {o.nomeOrgao ?? "—"}
                      <span className="block font-mono text-xs text-slate-500">{o.orgaoExecutor}</span>
                    </td>
                    <td className="py-2 text-right">{o.quantidade}</td>
                    <td className="py-2 text-right">{formatBRL(o.empenhado)}</td>
                    <td className="py-2 text-right">{formatBRL(o.pago)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {cadeia.data && (
        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <h2 className="font-semibold mb-3">Cadeia de execucao ({cadeia.data.totalDocumentos} documentos)</h2>
          <div className="space-y-4">
            {cadeia.data.estagios.map((est) => (
              <div key={est.estagio}>
                <h3 className="font-medium text-slate-700">{est.estagio} ({est.quantidade})</h3>
                <table className="w-full text-xs mt-2">
                  <thead className="text-slate-500 text-left"><tr>
                    <th className="pb-1">Documento</th>
                    <th className="pb-1">Data</th>
                    <th className="pb-1">UG</th>
                    <th className="pb-1">Favorecido</th>
                    <th className="pb-1 text-right">Valor</th>
                  </tr></thead>
                  <tbody>
                    {est.documentos.map((d) => (
                      <Fragment key={d.codigoDocumento}>
                        <tr className="border-t border-slate-100">
                          <td className="py-1 font-mono">{d.codigoDocumentoResumido ?? d.codigoDocumento}</td>
                          <td className="py-1">{formatDate(d.data)}</td>
                          <td className="py-1 font-mono" title={d.nomeOrgaoExecutor ?? undefined}>{d.orgaoExecutor ?? "—"}</td>
                          <td className="py-1">{d.nomeFavorecido ?? "—"}</td>
                          <td className="py-1 text-right">{d.valorDocumento != null ? formatBRL(d.valorDocumento) : "—"}</td>
                        </tr>
                        {d.observacao && (
                          <tr>
                            <td colSpan={5} className="pb-1 text-[11px] text-slate-500 italic">
                              {d.observacao}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
    </div>
  );
}
