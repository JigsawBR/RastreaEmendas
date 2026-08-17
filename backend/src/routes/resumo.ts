import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { pbLocalidadeFilter } from "../lib/filters.js";

export const resumoRouter = Router();

// GET /resumo?ano=2024
// Numeros gerais para o dashboard, restritos a PB via emenda_alocacao.
resumoRouter.get("/", async (req, res) => {
  const ano = req.query.ano ? Number(req.query.ano) : undefined;

  const alocacoes = await prisma.emenda_alocacao.findMany({
    where: {
      ...pbLocalidadeFilter(),
      ...(ano ? { emenda: { ano } } : {}),
    },
    include: { emenda: true },
  });

  const emendas = new Set<string>();
  const parlamentares = new Set<string>();
  const municipios = new Set<string>();
  let empenhado = 0, liquidado = 0, pago = 0, restoInscrito = 0;

  for (const a of alocacoes) {
    emendas.add(a.codigo_emenda);
    if (a.emenda.nome_autor) parlamentares.add(a.emenda.nome_autor);
    if (a.localidade_gasto) municipios.add(a.localidade_gasto);
    empenhado += Number(a.valor_empenhado ?? 0);
    liquidado += Number(a.valor_liquidado ?? 0);
    pago += Number(a.valor_pago ?? 0);
    restoInscrito += Number(a.valor_resto_inscrito ?? 0);
  }

  res.json({
    ano: ano ?? null,
    totalEmendas: emendas.size,
    totalParlamentares: parlamentares.size,
    totalLocalidades: municipios.size,
    valorEmpenhado: empenhado,
    valorLiquidado: liquidado,
    valorPago: pago,
    valorRestoInscrito: restoInscrito,
    taxaExecucao: empenhado > 0 ? pago / empenhado : 0,
  });
});
