import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { pbLocalidadeFilter } from "../lib/filters.js";

export const municipiosRouter = Router();

// GET /municipios?ano=
// RF-06: agregado por localidade (municipio ou UF).
municipiosRouter.get("/", async (req, res) => {
  const ano = req.query.ano ? Number(req.query.ano) : undefined;

  const alocacoes = await prisma.emenda_alocacao.findMany({
    where: {
      ...pbLocalidadeFilter(),
      ...(ano ? { emenda: { ano } } : {}),
    },
    select: {
      localidade_gasto: true,
      codigo_emenda: true,
      valor_empenhado: true,
      valor_liquidado: true,
      valor_pago: true,
    },
  });

  const map = new Map<string, {
    localidade: string;
    quantidadeEmendas: Set<string>;
    valorEmpenhado: number;
    valorLiquidado: number;
    valorPago: number;
  }>();

  for (const a of alocacoes) {
    const key = a.localidade_gasto;
    const acc = map.get(key) ?? {
      localidade: key,
      quantidadeEmendas: new Set<string>(),
      valorEmpenhado: 0,
      valorLiquidado: 0,
      valorPago: 0,
    };
    acc.quantidadeEmendas.add(a.codigo_emenda);
    acc.valorEmpenhado += Number(a.valor_empenhado ?? 0);
    acc.valorLiquidado += Number(a.valor_liquidado ?? 0);
    acc.valorPago += Number(a.valor_pago ?? 0);
    map.set(key, acc);
  }

  const items = Array.from(map.values())
    .map((m) => ({
      localidade: m.localidade,
      quantidadeEmendas: m.quantidadeEmendas.size,
      valorEmpenhado: m.valorEmpenhado,
      valorLiquidado: m.valorLiquidado,
      valorPago: m.valorPago,
    }))
    .sort((a, b) => b.valorEmpenhado - a.valorEmpenhado);

  res.json({ ano: ano ?? null, items });
});
