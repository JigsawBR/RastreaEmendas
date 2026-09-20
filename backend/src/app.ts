import express from "express";
import cors from "cors";
import { amendmentsRouter } from "./modules/amendments/http/amendments.router.js";
import { analyticsRouter } from "./modules/analytics/http/summary.router.js";
import { executionRouter } from "./modules/execution/http/execution.router.js";
import { exportRouter } from "./modules/exports/http/export.router.js";
import { municipalitiesRouter } from "./modules/locations/http/municipalities.router.js";
import { organizationsRouter } from "./modules/organizations/http/organizations.router.js";
import { parliamentariansRouter } from "./modules/parliamentarians/http/parliamentarians.router.js";
import { traceabilityRouter } from "./modules/traceability/http/traceability.router.js";
import { validateQuery } from "./shared/http/query-validation.js";
import { prisma } from "./shared/infrastructure/database/prisma.js";

export function buildApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(validateQuery);

  app.get("/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ok", db: "up" });
    } catch (err) {
      res.status(503).json({ status: "degraded", db: "down", error: String(err) });
    }
  });

  app.use("/emendas", amendmentsRouter);
  app.use("/emendas", executionRouter);
  app.use("/emendas", traceabilityRouter);
  app.use("/municipios", municipalitiesRouter);
  app.use("/parlamentares", parliamentariansRouter);
  app.use("/orgaos", organizationsRouter);
  app.use("/resumo", analyticsRouter);
  app.use("/export", exportRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "internal_error", message: String(err) });
  });

  return app;
}
