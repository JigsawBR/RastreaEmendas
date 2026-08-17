import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { pbLocalidadeFilter } from "../lib/filters.js";

export const exportRouter = Router();

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return s.includes(";") || s.includes("\"") || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [headers.join(";")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(";"));
  }
  return lines.join("\n");
}

// GET /export/emendas?ano=&parlamentar=&municipio=&funcao=
// RF-07: exporta a lista filtrada em CSV.
exportRouter.get("/emendas", async (req, res) => {
  const ano = req.query.ano ? Number(req.query.ano) : undefined;
  const parlamentar = req.query.parlamentar as string | undefined;
  const municipio = req.query.municipio as string | undefined;
  const funcao = req.query.funcao as string | undefined;

  const alocacaoWhere: Prisma.emenda_alocacaoWhereInput = {
    ...pbLocalidadeFilter(),
    ...(municipio ? { localidade_gasto: { contains: municipio, mode: "insensitive" } } : {}),
    ...(funcao ? { funcao: { contains: funcao, mode: "insensitive" } } : {}),
  };

  const emendas = await prisma.emenda.findMany({
    where: {
      ...(ano ? { ano } : {}),
      ...(parlamentar ? { nome_autor: { contains: parlamentar, mode: "insensitive" } } : {}),
      emenda_alocacao: { some: alocacaoWhere },
    },
    include: { emenda_alocacao: { where: alocacaoWhere } },
    orderBy: [{ ano: "desc" }, { codigo_emenda: "asc" }],
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

  const csv = toCsv(rows);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="emendas.csv"`);
  res.send(csv);
});
