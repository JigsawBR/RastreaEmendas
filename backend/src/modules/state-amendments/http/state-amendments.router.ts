import { Router } from "express";
import type { Request } from "express";
import type { StateAmendmentService } from "../application/state-amendment-service.js";
import type { StateFilters } from "../domain/state-amendment.js";
import { stateAmendmentsCsv } from "../infrastructure/state-amendment-csv.js";
import { findMunicipalityCode } from "../../../shared/territory/municipalities.js";
const SOURCE = {
  origem: "estadual",
  fonte: "CODATA — Dados Abertos da Paraíba",
  ultimaCarga: null,
};
function filters(req: Request): StateFilters {
  return {
    ano: req.query.ano ? Number(req.query.ano) : undefined,
    parlamentar: req.query.parlamentar as string | undefined,
    beneficiario: req.query.beneficiario as string | undefined,
    funcao: req.query.funcao as string | undefined,
    orgao: req.query.orgao as string | undefined,
    municipio: req.query.municipio
      ? findMunicipalityCode(req.query.municipio as string)
      : undefined,
  };
}
export function createStateAmendmentsRouter(service: StateAmendmentService) {
  const router = Router();
  // The state filter matches only municipal transfers, so it needs an exact
  // municipality (name or IBGE code), not a substring of free text.
  router.use((req, res, next) => {
    if (req.query.municipio !== undefined && !findMunicipalityCode(req.query.municipio as string))
      return res
        .status(400)
        .json({ error: "municipio_desconhecido", parametro: "municipio" });
    next();
  });
  router.get("/emendas", async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const offset = Number(req.query.offset ?? 0);
    res.json({
      ...SOURCE,
      ...(await service.list(filters(req), { limit, offset })),
      limit,
      offset,
    });
  });
  router.get("/resumo", async (req, res) =>
    res.json({
      ...SOURCE,
      ...(await service.summary(
        req.query.ano ? Number(req.query.ano) : undefined,
      )),
    }),
  );
  router.get("/export/emendas", async (req, res) => {
    const result = await service.list(filters(req));
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="emendas-estaduais.csv"',
    );
    res.send(stateAmendmentsCsv(result));
  });
  router.get("/emendas/:ano/:numero", async (req, res) => {
    const year = Number(req.params.ano);
    if (
      !/^\d{1,4}$/.test(req.params.ano) ||
      year < 1 ||
      !req.params.numero.trim()
    )
      return res.status(400).json({ error: "identidade_invalida" });
    const detail = await service.detail(year, req.params.numero);
    if (!detail)
      return res.status(404).json({ error: "emenda_estadual_nao_encontrada" });
    res.json({ ...SOURCE, ...detail });
  });
  return router;
}
