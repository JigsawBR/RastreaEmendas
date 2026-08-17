import express from "express";
import cors from "cors";
import { prisma } from "./lib/prisma.js";
import { emendasRouter } from "./routes/emendas.js";
import { municipiosRouter } from "./routes/municipios.js";
import { parlamentaresRouter } from "./routes/parlamentares.js";
import { orgaosRouter } from "./routes/orgaos.js";
import { resumoRouter } from "./routes/resumo.js";
import { exportRouter } from "./routes/export.js";

export function buildApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ok", db: "up" });
    } catch (err) {
      res.status(503).json({ status: "degraded", db: "down", error: String(err) });
    }
  });

  app.use("/emendas", emendasRouter);
  app.use("/municipios", municipiosRouter);
  app.use("/parlamentares", parlamentaresRouter);
  app.use("/orgaos", orgaosRouter);
  app.use("/resumo", resumoRouter);
  app.use("/export", exportRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "internal_error", message: String(err) });
  });

  return app;
}
