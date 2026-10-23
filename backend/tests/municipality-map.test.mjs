import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMunicipalityMap, municipalityKey } from "../dist/modules/federal-amendments/locations/territory.js";
import { buildApp } from "../dist/app.js";
import { prisma } from "../dist/shared/infrastructure/database/prisma.js";

test("mapa cobre 223 municípios e mantém valores federais e vínculos estaduais separados", () => {
  const result = buildMunicipalityMap([
    { localidade_gasto: "CAJAZEIRAS - PB", codigo_emenda: "202412340001", valor_empenhado: 100, valor_pago: 50 },
    { localidade_gasto: "CAJAZEIRAS - PB", codigo_emenda: "202412340001", valor_empenhado: 20, valor_pago: null },
    { localidade_gasto: "PARAÍBA (UF)", codigo_emenda: "202412340002", valor_empenhado: 900, valor_pago: 400 },
    { localidade_gasto: "SOUSA - PB", codigo_emenda: "202412340003", valor_empenhado: 0, valor_pago: 0 },
  ], [{ nome_beneficiario: "MUNICIPIO DE JOAO PESSOA", valor_custeio: 1000, valor_investimento: 0 }],
  [{ municipio: "CAMPINA GRANDE", valor_empenhado: 40, valor_pago: 10 }],
  [{ ano: 2024, numero_emenda: "0576/2024" }, { ano: 2024, numero_emenda: "0799" }],
  [{ year: 2024, amendment_number: "576", destination: "municipal_transfer", creditor_municipality_ibge: "2503704", committed_value: 300 },
   { year: 2024, amendment_number: "576", destination: "municipal_transfer", creditor_municipality_ibge: "2503704", committed_value: "200.50" },
   { year: 2024, amendment_number: "799", destination: "private_nonprofit", creditor_municipality_ibge: "2507507" },
   { year: 2024, amendment_number: "799", destination: "municipal_transfer", creditor_municipality_ibge: null },
   { year: 2023, amendment_number: "576", destination: "municipal_transfer", creditor_municipality_ibge: "2516201" }],
  [{ year: 2024, amendment_number: "576", payload: { nome: "MUNICIPIO DE CAJAZEIRAS", municipio: "Cajazeiras", valorInstrumento: 999999 } },
   { year: 2024, amendment_number: "799", payload: { nome: "ASSOCIACAO BENEFICENTE", municipio: "João Pessoa", valorInstrumento: 80000 } }]);
  assert.equal(result.items.length, 223);
  const cajazeiras = result.items.find(r => r.municipio === "Cajazeiras");
  assert.equal(cajazeiras.federal.emendas, 1);
  assert.equal(cajazeiras.federal.empenhado, 120);
  assert.equal(cajazeiras.federal.pago, 50);
  assert.equal(cajazeiras.estadual.quantidade, 1);
  assert.equal(cajazeiras.estadual.emendas[0].numero, "0576/2024");
  assert.equal(cajazeiras.estadual.emendas[0].fontes.length, 2);
  assert.equal(cajazeiras.estadual.valorTransferido, 500.5, "soma os empenhos transferidos; convênio não tem valor");
  assert.equal(result.items.find(r => r.municipio === "Sousa").estadual.valorTransferido, 0, "exercício fora da listagem não soma");
  assert.equal(result.items.find(r => r.municipio === "Sousa").estadual.quantidade, 0);
  assert.equal(result.items.find(r => r.municipio === "João Pessoa").estadual.quantidade, 0, "sede de entidade não é município beneficiado");
  assert.equal(result.items.find(r => r.municipio === "Sousa").federal.comRecursos, false);
  assert.equal(result.items.find(r => r.municipio === "João Pessoa").federal.valorPlanos, 1000);
  assert.equal(result.items.find(r => r.municipio === "Campina Grande").federal.despesaPago, 10);
  assert.deepEqual(result.semMunicipio, { alocacoesFederais: 1, emendasEstaduais: 1 });
  assert.equal(municipalityKey("  João Pessoa - PB  "), "JOAO PESSOA");
});

test("API do mapa exclui candidatos/contratos e filtra o exercício em cada fonte", async () => {
  const originals = [];
  const stub = (model, fn) => { originals.push([model, model.findMany]); model.findMany = fn; };
  stub(prisma.emenda_alocacao, async ({ where }) => { assert.equal(where.emenda.ano, 2024); return []; });
  stub(prisma.transferegov_plano_acao, async ({ where }) => { assert.equal(where.ano_emenda, 2024); return []; });
  stub(prisma.despesa_mensal, async ({ where }) => { assert.equal(where.ano_mes.startsWith, "2024"); return []; });
  stub(prisma.emenda_estadual, async ({ where }) => { assert.equal(where.ano, 2024); return []; });
  stub(prisma.state_amendment_destination, async ({ where }) => { assert.deepEqual(where, { year: 2024, destination: "municipal_transfer" }); return []; });
  stub(prisma.amendment_evidence, async ({ where }) => { assert.deepEqual(where, { origin: "state", year: 2024, source: "pb_agreements", kind: "agreement", status: "confirmed" }); return []; });
  stub(prisma.evidence_import, async () => []);
  const server = buildApp().listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/municipios/mapa`;
    const response = await fetch(url + "?ano=2024");
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.items.length, 223);
    assert.equal(body.ano, 2024);
    assert.ok(body.items.every(item => !item.federal.comRecursos && item.estadual.quantidade === 0));
    assert.equal((await fetch(url + "?ano=abc")).status, 400);
  } finally {
    await new Promise(resolve => server.close(resolve));
    for (const [model, original] of originals) model.findMany = original;
    await prisma.$disconnect();
  }
});
