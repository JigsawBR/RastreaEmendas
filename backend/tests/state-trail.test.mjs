import assert from "node:assert/strict";
import { test } from "node:test";
import { buildStateTrail } from "../dist/modules/state-amendments/domain/state-trail.js";
const listing = { ano: 2024, nome_deputado: "Autoria", objeto: "Finalidade", beneficiario_final: null };
const document = (kind, payload, link_status = "confirmed") => ({
  id: kind, kind, payload, link_status, source_url: "https://api.dados.pb.gov.br/", collected_at: new Date("2026-10-15"),
});
const imports = [{ kind: "commitment", month: 12, collected_at: new Date("2026-10-15") }];
test("trilha distingue origem, autoria, solicitante e entrega, sem inventar evidências", () => {
  const trail = buildStateTrail(listing, [], [], []);
  assert.equal(trail.rastreabilidade.score, null);
  for (const code of ["requester", "delivery"]) {
    assert.deepEqual(trail.trajeto.find(s => s.codigo === code).evidencias, []);
    assert.ok(trail.trajeto.find(s => s.codigo === code).lacuna);
  }
  assert.deepEqual(trail.trajeto.find(s => s.codigo === "author").evidencias, ["Autoria"]);
});
test("anulações, zero e pagamentos candidatos não comprovam fase do RF-08", () => {
  const trail = buildStateTrail(listing, [], [
    document("commitment", { valorCalculado: -60, descricaoTipo: "ANULAÇÃO", nomeFuncao: "Saúde", nomeOrgao: "SES" }),
    document("liquidation", { valorEmpenhado: 0, valorGD: 60 }),
    document("payment", { valorPago: 60 }, "candidate"),
  ], imports);
  assert.equal(trail.rastreabilidade.score, 40);
  assert.equal(trail.rastreabilidade.completa, false);
  assert.equal(trail.coberturaDocumental.completa, false);
  assert.deepEqual(trail.trajeto.find(s => s.codigo === "spending").evidencias, []);
});
test("cinco critérios documentados não significam entrega física comprovada", () => {
  const docs = [
    document("commitment", { valorCalculado: 60, descricaoTipo: "PRINCIPAL", nomeFuncao: "Saúde", nomeOrgao: "SES" }),
    document("liquidation", { numeroDocumento: 1, valorEmpenhado: 60, valorGD: 0 }),
    document("payment", { valorPago: 60 }),
  ];
  const allMonths = ["commitment", "liquidation", "payment"].flatMap(kind => Array.from({length: 12}, (_, i) => ({ ...imports[0], kind, month: i + 1 })));
  const trail = buildStateTrail(listing, [], docs, allMonths);
  assert.equal(trail.rastreabilidade.score, 100);
  assert.equal(trail.coberturaDocumental.completa, true);
  assert.deepEqual(trail.trajeto.find(s => s.codigo === "delivery").evidencias, []);
});
