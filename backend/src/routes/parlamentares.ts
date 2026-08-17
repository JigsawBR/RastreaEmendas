import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { pbLocalidadeFilter } from "../lib/filters.js";

export const parlamentaresRouter = Router();

// GET /parlamentares?ano=
parlamentaresRouter.get("/", async (req, res) => {
  const ano = req.query.ano ? Number(req.query.ano) : undefined;

  const alocacoes = await prisma.emenda_alocacao.findMany({
    where: {
      ...pbLocalidadeFilter(),
      ...(ano ? { emenda: { ano } } : {}),
    },
    include: { emenda: true },
  });

  const map = new Map<string, {
    nomeAutor: string;
    autor: string | null;
    quantidadeEmendas: Set<string>;
    valorEmpenhado: number;
    valorLiquidado: number;
    valorPago: number;
  }>();

  for (const a of alocacoes) {
    const key = a.emenda.nome_autor ?? "Sem autor";
    const acc = map.get(key) ?? {
      nomeAutor: key,
      autor: a.emenda.autor,
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
      nomeAutor: m.nomeAutor,
      autor: m.autor,
      quantidadeEmendas: m.quantidadeEmendas.size,
      valorEmpenhado: m.valorEmpenhado,
      valorLiquidado: m.valorLiquidado,
      valorPago: m.valorPago,
    }))
    .sort((a, b) => b.valorEmpenhado - a.valorEmpenhado);

  res.json({ ano: ano ?? null, items });
});
