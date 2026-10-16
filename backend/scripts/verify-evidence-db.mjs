import "dotenv/config";
import assert from "node:assert/strict";
import { prisma } from "../dist/shared/infrastructure/database/prisma.js";
import { buildApp } from "../dist/app.js";

let server;
try {
  const counts = await prisma.amendment_evidence.groupBy({ by: ["origin", "year", "source", "kind", "status"], _count: true, orderBy: [{ origin: "asc" }, { year: "asc" }, { source: "asc" }, { kind: "asc" }] });
  console.log("Evidências na base:", JSON.stringify(counts));
  server = buildApp().listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const [number, kind, name] of [["0576", "agreement", "INSTITUTO VEM CUIDAR DE MIM"], ["0799", "contract", "EXA ENGENHARIA E ARQUITETURA LTDA"]]) {
    const response = await fetch(`${base}/evidencias/state/2024/${number}`);
    assert.equal(response.status, 200);
    const body = await response.json();
    const found = body.evidencias.find(r => r.tipo === kind && r.status === "confirmed" && r.dados.nome === name);
    assert.ok(found, `Vínculo real ${number} / ${kind}`);
    assert.ok(found.regraVinculo && found.fonteUrl && found.coletadoEm);
    assert.equal(body.valorPago, undefined);
    assert.ok(body.cobertura.some(c => c.fonte === "pb_contracts"));
  }
  const federal = await prisma.amendment_evidence.findFirst({ where: { origin: "federal", source: "transferegov_specials", kind: "management_report" } });
  if (federal) {
    const response = await fetch(`${base}/evidencias/federal/${federal.year}/${federal.amendment_number}`);
    assert.equal(response.status, 200);
    assert.ok((await response.json()).evidencias.some(r => r.tipo === "management_report" && r.status === "declared"));
  }
  assert.equal(await prisma.amendment_evidence.count({ where: { source: "siconv_candidates", status: { not: "candidate" } } }), 0);
  assert.equal(await prisma.amendment_evidence.count({ where: { source: "pb_payment_queue", status: { not: "candidate" } } }), 0);
  console.log("Vínculos estaduais reais, API de evidências e distinção entre declaração e confirmação: OK.");
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await prisma.$disconnect();
}
