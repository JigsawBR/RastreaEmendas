import { Router } from "express";
import { pbLocalidadeFilter } from "../../amendments/infrastructure/amendment-filters.js";
import { listFundingDestinations } from "../../execution/application/list-funding-destinations.js";
import { prisma } from "../../../shared/infrastructure/database/prisma.js";

export const analyticsRouter = Router();

// GET /resumo/destino?ano=2024
// Responde "para onde o dinheiro foi", que a localidade do gasto nao responde:
// 75% do valor cai no balde "PARAÍBA (UF)", que nao e um municipio.
analyticsRouter.get("/destino", async (req, res) => {
  const ano = req.query.ano ? Number(req.query.ano) : undefined;
  const grupos = await listFundingDestinations({ ano });
  res.json({
    ano: ano ?? null,
    valorTotal: grupos.reduce((s, g) => s + g.valor, 0),
    grupos,
  });
});

// GET /resumo?ano=2024
// Numeros gerais para o dashboard, restritos a PB via emenda_alocacao.
analyticsRouter.get("/", async (req, res) => {
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
