import "dotenv/config";
import assert from "node:assert/strict";
import { prisma } from "../dist/shared/infrastructure/database/prisma.js";
import { buildApp } from "../dist/app.js";
let server;
try {
  let listing;
  try {
    listing = await prisma.emenda_estadual.findFirst({
      orderBy: [{ ano: "desc" }, { numero_emenda: "asc" }],
    });
  } catch {
    console.error(
      "PostgreSQL indisponível para verificação real da base estadual.",
    );
    process.exitCode = 1;
  }
  if (!process.exitCode) {
    server = buildApp().listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const base = "http://127.0.0.1:" + server.address().port;
    const year = listing?.ano ?? 2024;
    for (const endpoint of [
      "/estaduais/resumo?ano=" + year,
      "/estaduais/emendas?ano=" + year + "&limit=2",
      "/estaduais/export/emendas?ano=" + year,
    ]) {
      const response = await fetch(base + endpoint);
      assert.equal(response.status, 200, endpoint);
      if (endpoint.includes("/export/")) {
        assert.match(await response.text(), /numero_emenda/);
      } else {
        const result = await response.json();
        assert.equal(result.origem, "estadual");
      }
    }
    if (listing) {
      const response = await fetch(
        base +
          "/estaduais/emendas/" +
          year +
          "/" +
          encodeURIComponent(listing.numero_emenda),
      );
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.ano, year);
      assert.equal(result.numeroEmenda, listing.numero_emenda);
      assert.ok(Array.isArray(result.documentos));
      assert.ok(Array.isArray(result.trajeto));
      assert.equal(result.trajeto.find(step => step.codigo === "requester").evidencias.length, 0);
    }
    const imported = await prisma.state_expense_document.findFirst({ where: { kind: "commitment" } });
    if (imported) {
      const listings = await prisma.emenda_estadual.findMany({ where: { ano: imported.year } });
      const original = listings.find(row => String(Number(row.numero_emenda.split("/")[0])) === imported.amendment_number);
      assert.ok(original);
      const response = await fetch(base + "/estaduais/emendas/" + imported.year + "/" + encodeURIComponent(original.numero_emenda));
      assert.equal(response.status, 200);
      const detail = await response.json();
      assert.ok(detail.documentos.some(document => document.id === imported.id));
      assert.equal(detail.rastreabilidade.avaliavel, true);
      assert.equal(detail.trajeto.find(step => step.codigo === "delivery").evidencias.length, 0);
      console.log(JSON.stringify({ emendaVerificada: original.numero_emenda,
        documentos: detail.documentos.length, coberturaCompleta: detail.coberturaDocumental.completa,
        criteriosDocumentados: detail.rastreabilidade.score }));
    }
    console.log(
      JSON.stringify({
        verificacao: "API estadual consultou PostgreSQL com sucesso",
        ano: year,
        listagem: await prisma.emenda_estadual.count(),
        linhasExecucao: await prisma.emenda_estadual_execucao.count(),
      }),
    );
  }
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
}
