import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const orgaosRouter = Router();

// GET /orgaos?ano=
// Agrega despesa_mensal (que tem UF=PB, nome_autor_emenda != "SEM EMENDA")
// por orgao superior e por orgao subordinado. Fonte com nome de pasta.
orgaosRouter.get("/", async (req, res) => {
  const ano = req.query.ano ? String(req.query.ano) : undefined;

  const despesas = await prisma.despesa_mensal.findMany({
    where: {
      uf: "PB",
      ...(ano ? { ano_mes: { startsWith: `${ano}/` } } : {}),
    },
    select: {
      codigo_orgao_superior: true,
      nome_orgao_superior: true,
      codigo_orgao: true,
      nome_orgao: true,
      valor_empenhado: true,
      valor_liquidado: true,
      valor_pago: true,
    },
  });

  type Agg = {
    codigo: string | null;
    nome: string;
    valorEmpenhado: number;
    valorLiquidado: number;
    valorPago: number;
  };

  const superior = new Map<string, Agg>();
  const subordinado = new Map<string, Agg>();

  for (const d of despesas) {
    const supKey = d.nome_orgao_superior ?? "Nao classificado";
    const sup = superior.get(supKey) ?? {
      codigo: d.codigo_orgao_superior,
      nome: supKey,
      valorEmpenhado: 0, valorLiquidado: 0, valorPago: 0,
    };
    sup.valorEmpenhado += Number(d.valor_empenhado ?? 0);
    sup.valorLiquidado += Number(d.valor_liquidado ?? 0);
    sup.valorPago += Number(d.valor_pago ?? 0);
    superior.set(supKey, sup);

    const subKey = d.nome_orgao ?? "Nao classificado";
    const sub = subordinado.get(subKey) ?? {
      codigo: d.codigo_orgao,
      nome: subKey,
      valorEmpenhado: 0, valorLiquidado: 0, valorPago: 0,
    };
    sub.valorEmpenhado += Number(d.valor_empenhado ?? 0);
    sub.valorLiquidado += Number(d.valor_liquidado ?? 0);
    sub.valorPago += Number(d.valor_pago ?? 0);
    subordinado.set(subKey, sub);
  }

  const sortDesc = (a: Agg, b: Agg) => b.valorEmpenhado - a.valorEmpenhado;

  res.json({
    ano: ano ?? null,
    orgaosSuperiores: Array.from(superior.values()).sort(sortDesc),
    orgaosSubordinados: Array.from(subordinado.values()).sort(sortDesc),
  });
});
