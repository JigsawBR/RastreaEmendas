import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, type DestinoResponse } from "../lib/api";
import { formatBRL, formatInt, formatPct } from "../lib/format";

const CORES: Record<string, string> = {
  municipio: "bg-emerald-500",
  estado: "bg-sky-500",
  federal: "bg-indigo-500",
  privado: "bg-amber-500",
  pessoa_fisica: "bg-slate-400",
  nao_informado: "bg-slate-300",
};

type Props = { ano: number } | { codigoEmenda: string };

export default function DestinoDoDinheiro(props: Props) {
  const porEmenda = "codigoEmenda" in props;
  const { data, isLoading, error } = useQuery({
    queryKey: porEmenda ? ["destino", props.codigoEmenda] : ["destino", props.ano],
    queryFn: () =>
      porEmenda ? api.destinoEmenda(props.codigoEmenda) : api.destino(props.ano),
  });

  if (isLoading) return <p className="text-slate-500">Carregando...</p>;
  if (error) return <p className="text-red-600">Erro: {String(error)}</p>;
  if (!data || data.grupos.length === 0) {
    return <p className="text-slate-500">Sem empenhos com favorecido identificado.</p>;
  }

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-5">
      <h2 className="text-lg font-semibold text-slate-900">Para onde o dinheiro foi</h2>
      <p className="text-sm text-slate-600 mt-1">
        Quem recebeu os empenhos, {formatBRL(data.valorTotal)} no total.
        {!porEmenda && (
          <>
            {" "}A localidade do gasto informada pelo Portal diz apenas onde a despesa foi
            registrada, e boa parte aparece como &ldquo;PARAÍBA (UF)&rdquo;, que não é um
            município.
          </>
        )}{" "}
        Aqui o agrupamento é por quem de fato recebeu o pagamento.
      </p>

      <Barra data={data} />

      <div className="mt-5 space-y-3">
        {data.grupos.map((g) => (
          <Grupo key={g.destino} grupo={g} total={data.valorTotal} />
        ))}
      </div>

      <p className="text-xs text-slate-500 mt-5 border-t border-slate-200 pt-3">
        Classificação derivada da natureza jurídica do favorecido, publicada nos arquivos
        abertos da CGU. Não é um campo informado pela fonte: é inferência a partir de quem
        recebeu cada empenho.
      </p>
    </section>
  );
}

function Barra({ data }: { data: DestinoResponse }) {
  return (
    <div className="flex h-3 rounded-full overflow-hidden mt-4 bg-slate-100">
      {data.grupos.map((g) => (
        <div
          key={g.destino}
          className={CORES[g.destino] ?? "bg-slate-300"}
          style={{ width: `${(g.valor / data.valorTotal) * 100}%` }}
          title={`${g.rotulo}: ${formatBRL(g.valor)}`}
        />
      ))}
    </div>
  );
}

function Grupo({ grupo, total }: { grupo: DestinoResponse["grupos"][number]; total: number }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="border border-slate-200 rounded-md">
      <button
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-slate-50"
      >
        <span className={`w-3 h-3 rounded-sm mt-1 shrink-0 ${CORES[grupo.destino] ?? "bg-slate-300"}`} />
        <span className="flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className="font-medium text-slate-900">{grupo.rotulo}</span>
            <span className="text-slate-900 font-semibold whitespace-nowrap">
              {formatBRL(grupo.valor)}{" "}
              <span className="text-slate-500 font-normal">
                ({formatPct(grupo.valor / total)})
              </span>
            </span>
          </span>
          <span className="block text-sm text-slate-600 mt-0.5">{grupo.descricao}</span>
          <span className="block text-xs text-slate-500 mt-1">
            {formatInt(grupo.documentos)} {grupo.documentos === 1 ? "empenho" : "empenhos"} ·{" "}
            {aberto ? "ocultar" : "ver"} quem recebeu
          </span>
        </span>
      </button>

      {aberto && (
        <ul className="border-t border-slate-200 divide-y divide-slate-100">
          {grupo.favorecidos.map((f) => (
            <li key={f.nome} className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
              <span className="text-slate-700">
                {f.nome}
                {f.municipio && (
                  <span className="text-slate-500">
                    {" "}
                    · {f.municipio}
                    {grupo.destino === "privado" && " (endereço do favorecido)"}
                  </span>
                )}
              </span>
              <span className="text-slate-900 whitespace-nowrap">{formatBRL(f.valor)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
