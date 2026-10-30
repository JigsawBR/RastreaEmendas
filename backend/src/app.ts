import express from "express";
import cors from "cors";
import { evidenceRouter } from "./modules/evidence/evidence.router.js";
import { municipalityMapRouter } from "./modules/federal-amendments/locations/http/municipality-map.router.js";
import { amendmentsRouter } from "./modules/federal-amendments/amendments/http/amendments.router.js";
import { analyticsRouter } from "./modules/federal-amendments/analytics/http/summary.router.js";
import { executionRouter } from "./modules/federal-amendments/execution/http/execution.router.js";
import { exportRouter } from "./modules/federal-amendments/exports/http/export.router.js";
import { municipalitiesRouter } from "./modules/federal-amendments/locations/http/municipalities.router.js";
import { nationalAmendmentsRouter } from "./modules/federal-amendments/national/http/national-amendments.router.js";
import { organizationsRouter } from "./modules/federal-amendments/organizations/http/organizations.router.js";
import { parliamentariansRouter } from "./modules/federal-amendments/parliamentarians/http/parliamentarians.router.js";
import { traceabilityRouter } from "./modules/federal-amendments/traceability/http/traceability.router.js";
import { validateQuery } from "./shared/http/query-validation.js";
import { prisma } from "./shared/infrastructure/database/prisma.js";

import { createStateAmendmentsRouter } from "./modules/state-amendments/http/state-amendments.router.js";

import { createStateAmendmentService } from "./modules/state-amendments/application/state-amendment-service.js";
import { createPrismaStateAmendmentRepository } from "./modules/state-amendments/infrastructure/prisma-state-amendment-repository.js";

export function buildApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(validateQuery);
  app.use("/evidencias", evidenceRouter);

  app.get("/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ok", db: "up" });
    } catch (err) {
      res
        .status(503)
        .json({ status: "degraded", db: "down", error: String(err) });
    }
  });

  const stateService = createStateAmendmentService(
    createPrismaStateAmendmentRepository(prisma),
  );
  app.use("/estaduais", createStateAmendmentsRouter(stateService));
  app.use("/emendas", amendmentsRouter);
  app.use("/emendas", executionRouter);
  app.use("/emendas", traceabilityRouter);
  app.use("/emendas-nacionais", nationalAmendmentsRouter);
  app.use("/municipios", municipalitiesRouter);
  app.use("/municipios", municipalityMapRouter);
  app.use("/parlamentares", parliamentariansRouter);
  app.use("/orgaos", organizationsRouter);
  app.use("/resumo", analyticsRouter);
  app.use("/export", exportRouter);

  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error(err);
      res.status(500).json({ error: "internal_error", message: String(err) });
    },
  );

  return app;
}
