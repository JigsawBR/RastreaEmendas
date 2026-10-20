import { Router } from "express";
import { prisma } from "../../../../shared/infrastructure/database/prisma.js";
import { pbLocalidadeFilter } from "../../amendments/infrastructure/amendment-filters.js";
import { buildMunicipalityMap } from "../territory.js";

export const municipalityMapRouter = Router();
municipalityMapRouter.get("/mapa", async (req, res, next) => {
  try {
    const year = req.query.ano ? Number(req.query.ano) : undefined;
    const [allocations, plans, expenses, listings, destinations, agreements, coverage] = await Promise.all([
      prisma.emenda_alocacao.findMany({ where: { ...pbLocalidadeFilter(), ...(year ? { emenda: { ano: year } } : {}) }, select: { localidade_gasto: true, codigo_emenda: true, valor_empenhado: true, valor_pago: true } }),
      prisma.transferegov_plano_acao.findMany({ where: { uf_beneficiario: "PB", ...(year ? { ano_emenda: year } : {}) }, select: { nome_beneficiario: true, valor_custeio: true, valor_investimento: true } }),
      prisma.despesa_mensal.findMany({ where: { uf: "PB", ...(year ? { ano_mes: { startsWith: String(year) } } : {}) }, select: { municipio: true, valor_empenhado: true, valor_pago: true } }),
      prisma.emenda_estadual.findMany({ where: year ? { ano: year } : {}, select: { ano: true, numero_emenda: true } }),
      prisma.state_amendment_destination.findMany({ where: { ...(year ? { year } : {}), destination: "municipal_transfer" }, select: { year: true, amendment_number: true, destination: true, creditor_municipality_ibge: true } }),
      prisma.amendment_evidence.findMany({ where: { origin: "state", ...(year ? { year } : {}), source: "pb_agreements", kind: "agreement", status: "confirmed" }, select: { year: true, amendment_number: true, payload: true } }),
      prisma.evidence_import.findMany({ where: { origin: "state", source: "pb_agreements", ...(year ? { year } : {}) }, select: { year: true, collected_at: true } }),
    ]);
    res.json({ ano: year ?? null, ...buildMunicipalityMap(allocations, plans, expenses, listings, destinations, agreements), coberturaEstadual: coverage.map(row => ({ ano: row.year, coletadoEm: row.collected_at })),
      criterio: "Destaque federal: valores positivos nas alocações, execução mensal ou planos. Destaque estadual: empenho líquido positivo transferido ao município (modalidade de aplicação 40–42) ou instrumento confirmado em que o próprio município é o convenente. A sede de entidades privadas, credoras ou convenentes, não municipaliza o recurso. Vínculos territoriais não comprovam pagamento ou local de entrega; valores das fontes não são somados." });
  } catch (error) { next(error); }
});
