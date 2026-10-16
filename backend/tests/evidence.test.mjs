import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../dist/app.js";
import { prisma } from "../dist/shared/infrastructure/database/prisma.js";
import { safeEvidenceUrl } from "../dist/modules/evidence/evidence.router.js";

test("evidências têm escopo por origem, exercício e número sem alterar valores ou RF-08", async () => {
  const originals = [];
  const stub = (model, method, fn) => { originals.push([model, method, model[method]]); model[method] = fn; };
  const at = new Date("2026-10-15T12:00:00Z");
  stub(prisma.emenda_estadual, "findMany", async () => [{ numero_emenda: "0576/2024" }]);
  stub(prisma.emenda, "findFirst", async ({ where }) => where.codigo_emenda === "202443170008" ? { codigo_emenda: where.codigo_emenda } : null);
  stub(prisma.amendment_evidence, "findMany", async ({ where }) => {
    assert.equal(where.year, 2024);
    assert.ok(["576", "202443170008"].includes(where.amendment_number));
    return [{ id: "test", source: "test", kind: "agreement", status: "confirmed", title: "Instrumento", source_url: "https://example.gov.br/api", collected_at: at, match_basis: "Referência explícita", payload: { nome: "Convenente", documentoUrl: "javascript:alert(1)", valorInstrumento: 100 } }];
  });
  stub(prisma.evidence_import, "findMany", async ({ where }) => { assert.equal(where.year, 2024); return []; });
  const server = buildApp().listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const get = (path) => fetch(`http://127.0.0.1:${server.address().port}/evidencias${path}`);
  try {
    const response = await get("/state/2024/0576%2F2024");
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.numeroEmenda, "576");
    assert.equal(result.evidencias[0].dados.documentoUrl, null);
    assert.equal(result.evidencias[0].dados.nome, "Convenente");
    assert.equal(result.evidencias[0].coletadoEm, at.toISOString());
    assert.equal(result.valorPago, undefined);
    assert.equal(result.rastreabilidade, undefined);
    assert.equal((await get("/federal/2024/202443170008")).status, 200);
    assert.equal((await get("/state/2024/0576%2F2025")).status, 400);
    assert.equal((await get("/state/2024/9999")).status, 404);
    assert.equal((await get("/federal/2024/000000000000")).status, 404);
    assert.equal((await get("/state/abc/576")).status, 400);
    assert.equal((await get("/invalid/2024/576")).status, 400);
  } finally {
    await new Promise(resolve => server.close(resolve));
    for (const [model, method, original] of originals) model[method] = original;
    await prisma.$disconnect();
  }
});

test("links documentais aceitam apenas HTTP(S) sem credenciais", () => {
  assert.equal(safeEvidenceUrl("https://pncp.gov.br/app/contratos/1"), "https://pncp.gov.br/app/contratos/1");
  for (const url of ["javascript:alert(1)", "data:text/html,test", "https://user:password@example.com", "file:///tmp/a", null, "malformed"]) assert.equal(safeEvidenceUrl(url), null);
});
