import { Router } from "express";
import { prisma } from "../../../shared/infrastructure/database/prisma.js";
import { calculateTraceability } from "../domain/calculate-traceability.js";

export const traceabilityRouter = Router();

// RF-08: cinco critérios binários medem a completude da cadeia.
traceabilityRouter.get("/:codigo/rastreabilidade", async (req, res) => {
  const codigo = req.params.codigo;
  const emenda = await prisma.emenda.findUnique({
    where: { codigo_emenda: codigo },
    select: { codigo_emenda: true },
  });
  if (!emenda) return res.status(404).json({ error: "emenda_nao_encontrada" });

  const [documentos, alocacoes] = await Promise.all([
    prisma.documento_despesa.findMany({
      where: { codigo_emenda: codigo },
      select: { estagio: true, orgao_executor: true },
    }),
    prisma.emenda_alocacao.findMany({
      where: { codigo_emenda: codigo },
      select: { funcao: true },
    }),
  ]);

  res.json({
    codigoEmenda: codigo,
    ...calculateTraceability(documentos, alocacoes),
  });
});
