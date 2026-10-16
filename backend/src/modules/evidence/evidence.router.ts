import { Router } from "express";
import { prisma } from "../../shared/infrastructure/database/prisma.js";

export function safeEvidenceUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value);
    return ["https:", "http:"].includes(parsed.protocol) && !parsed.username && !parsed.password ? parsed.href : null;
  } catch { return null; }
}

export const evidenceRouter = Router();
evidenceRouter.get("/:origin/:year/:number", async (req, res, next) => {
  try {
    const { origin, year: rawYear, number: rawNumber } = req.params;
    if (!["state", "federal"].includes(origin) || !/^\d{4}$/.test(rawYear) || !/^\d{1,12}(?:\/\d{4})?$/.test(rawNumber)) {
      res.status(400).json({ error: "identidade_invalida" }); return;
    }
    const year = Number(rawYear);
    if (rawNumber.includes("/") && rawNumber.split("/")[1] !== rawYear) {
      res.status(400).json({ error: "exercicio_divergente" }); return;
    }
    const number = origin === "state" ? String(Number(rawNumber.split("/")[0])) : rawNumber;
    const exists = origin === "state"
      ? (await prisma.emenda_estadual.findMany({ where: { ano: year }, select: { numero_emenda: true } })).some(r => String(Number(r.numero_emenda.split("/")[0])) === number)
      : !!await prisma.emenda.findFirst({ where: { codigo_emenda: number, ano: year }, select: { codigo_emenda: true } });
    if (!exists) { res.status(404).json({ error: "emenda_nao_encontrada" }); return; }
    const [records, imports] = await Promise.all([
      prisma.amendment_evidence.findMany({ where: { origin, year, amendment_number: number }, orderBy: [{ kind: "asc" }, { title: "asc" }, { id: "asc" }] }),
      prisma.evidence_import.findMany({ where: { origin, year }, orderBy: { source: "asc" } }),
    ]);
    res.json({
      origem: origin, ano: year, numeroEmenda: number,
      evidencias: records.map(r => ({
        id: r.id, fonte: r.source, tipo: r.kind, status: r.status, titulo: r.title,
        fonteUrl: safeEvidenceUrl(r.source_url), coletadoEm: r.collected_at.toISOString(), regraVinculo: r.match_basis,
        dados: Object.fromEntries(Object.entries(r.payload as Record<string, unknown>).map(([key, value]) => [key, key.endsWith("Url") ? safeEvidenceUrl(value) : value])),
      })),
      cobertura: imports.map(i => ({ fonte: i.source, registrosConsultados: i.source_count, evidenciasNoExercicio: i.evidence_count, coletadoEm: i.collected_at.toISOString(), escopo: i.scope })),
      observacao: "Evidências complementares não alteram o RF-08 nem os totais financeiros. Vínculo confirmado não certifica pagamento, entrega ou regularidade.",
    });
  } catch (error) { next(error); }
});
