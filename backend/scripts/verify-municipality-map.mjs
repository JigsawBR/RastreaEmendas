import "dotenv/config";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildApp } from "../dist/app.js";
import { prisma } from "../dist/shared/infrastructure/database/prisma.js";

let server;
try {
  const geography = JSON.parse(await readFile(new URL("../../frontend/public/maps/paraiba.geojson", import.meta.url), "utf8"));
  const codes = new Set(geography.features.map(feature => feature.properties.code));
  assert.equal(codes.size, 223);
  server = buildApp().listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  for (const year of [2023, 2024, 2025, 2026]) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/municipios/mapa?ano=${year}`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ano, year);
    assert.equal(body.items.length, 223);
    assert.ok(body.items.every(item => codes.has(item.codigoIbge)));
    const federal = body.items.filter(item => item.federal.comRecursos).length;
    const state = body.items.filter(item => item.estadual.quantidade > 0).length;
    const both = body.items.filter(item => item.federal.comRecursos && item.estadual.quantidade > 0).length;
    console.log(JSON.stringify({ year, municipalities: body.items.length, federal, state, both, withoutMunicipality: body.semMunicipio }));
  }
  console.log("Malha IBGE e mapa de 2023–2026 conferidos contra PostgreSQL real.");
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await prisma.$disconnect();
}
