import { Router } from "express";
import { prisma } from "../../../../shared/infrastructure/database/prisma.js";
import { describeNationalAmendment, describeRecipients, type NationalRecipient } from "../domain/national-amendment.js";

export const nationalAmendmentsRouter = Router();

// GET /emendas-nacionais?ano=
// Kept apart from /emendas: their own values cover every state and would
// inflate the Paraíba totals if added to them.
nationalAmendmentsRouter.get("/", async (req, res) => {
  const ano = req.query.ano ? Number(req.query.ano) : undefined;
  const where = ano ? { ano } : {};
  const [amendments, recipients] = await Promise.all([
    prisma.emenda_nacional.findMany({ where }),
    prisma.emenda_nacional_destino.findMany({ where }),
  ]);
  const byAmendment = new Map<string, NationalRecipient[]>();
  for (const recipient of recipients) {
    byAmendment.set(recipient.codigo_emenda, [...(byAmendment.get(recipient.codigo_emenda) ?? []), recipient]);
  }
  const items = amendments
    .map((amendment) => describeNationalAmendment(amendment, byAmendment.get(amendment.codigo_emenda) ?? []))
    .sort((a, b) => b.recebidoEntes - a.recebidoEntes);
  res.json({
    ano: ano ?? null,
    totalEmendas: items.length,
    recebidoEntes: items.reduce((sum, item) => sum + item.recebidoEntes, 0),
    recebidoPrivados: items.reduce((sum, item) => sum + item.recebidoPrivados, 0),
    items,
  });
});

nationalAmendmentsRouter.get("/:codigo", async (req, res) => {
  const [amendment, recipients] = await Promise.all([
    prisma.emenda_nacional.findUnique({ where: { codigo_emenda: req.params.codigo } }),
    prisma.emenda_nacional_destino.findMany({ where: { codigo_emenda: req.params.codigo } }),
  ]);
  if (!amendment) return res.status(404).json({ error: "emenda_nao_encontrada" });
  res.json({ ...describeNationalAmendment(amendment, recipients), favorecidos: describeRecipients(recipients) });
});
