import { Router } from "express";
import { findAmendments } from "../../amendments/application/find-amendments.js";
import { serializeCsv } from "../../../../shared/serialization/csv.js";

export const exportRouter = Router();

// GET /export/emendas?ano=&parlamentar=&municipio=&funcao=
// RF-07: exporta a lista filtrada em CSV.
exportRouter.get("/emendas", async (req, res) => {
  const ano = req.query.ano ? Number(req.query.ano) : undefined;
  const parlamentar = req.query.parlamentar as string | undefined;
  const municipio = req.query.municipio as string | undefined;
  const funcao = req.query.funcao as string | undefined;

  const { rows: emendas } = await findAmendments({
    ano,
    parlamentar,
    municipio,
    funcao,
    orgao: req.query.orgao as string | undefined,
  });

  const rows: Record<string, unknown>[] = [];
  for (const e of emendas) {
    for (const a of e.emenda_alocacao) {
      rows.push({
        codigo_emenda: e.codigo_emenda,
        ano: e.ano,
        tipo_emenda: e.tipo_emenda,
        nome_autor: e.nome_autor,
        localidade_gasto: a.localidade_gasto,
        funcao: a.funcao,
        subfuncao: a.subfuncao,
        valor_empenhado: a.valor_empenhado ? Number(a.valor_empenhado) : 0,
        valor_liquidado: a.valor_liquidado ? Number(a.valor_liquidado) : 0,
        valor_pago: a.valor_pago ? Number(a.valor_pago) : 0,
      });
    }
  }

  const headers = [
    "codigo_emenda",
    "ano",
    "tipo_emenda",
    "nome_autor",
    "localidade_gasto",
    "funcao",
    "subfuncao",
    "valor_empenhado",
    "valor_liquidado",
    "valor_pago",
  ];
  const csv = serializeCsv(
    headers,
    rows.map((row) => headers.map((header) => row[header])),
  );
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="emendas.csv"`);
  res.send(csv);
});
