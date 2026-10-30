import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../dist/app.js";
import { pbLocalidadeFilter } from "../dist/modules/federal-amendments/amendments/infrastructure/amendment-filters.js";
import { describeNationalAmendment } from "../dist/modules/federal-amendments/national/domain/national-amendment.js";
import { prisma } from "../dist/shared/infrastructure/database/prisma.js";

const amendment = { codigo_emenda: "202650410002", ano: 2026, tipo_emenda: "Emenda de Comissão", nome_autor: "COM. DA SAUDE",
  numero_emenda: "0002", localidades: "MÚLTIPLO", funcoes: "Saúde", valor_empenhado_total: "1456477433.00", valor_pago_total: "1000.00" };
const recipient = (esfera, valor, codigo_ibge = null) => ({ codigo_emenda: "202650410002", codigo_favorecido: `${esfera}${valor}`,
  nome_favorecido: esfera, natureza_juridica: null, esfera, municipio_favorecido: null, codigo_ibge, valor_recebido: String(valor) });

test("emenda nacional conta como da PB só o que entes públicos da PB receberam", () => {
  const item = describeNationalAmendment(amendment, [
    recipient("municipal", 500, "2503209"), recipient("municipal", 300, "2503209"),
    recipient("estadual", 200), recipient("privado", 70, "2507507"),
  ]);
  assert.equal(item.recebidoEntes, 1000);
  assert.equal(item.recebidoPrivados, 70);
  assert.equal(item.municipios, 1, "o município do fornecedor é sede, não destino");
  assert.equal(item.valorEmpenhadoTotal, 1456477433, "valor da emenda inteira, só para contexto");
});

test("MÚLTIPLO entra no recorte da PB porque o ETL só grava o aplicado na PB", () => {
  assert.ok(pbLocalidadeFilter().OR.some((condition) => condition.localidade_gasto === "MÚLTIPLO"));
});

test("rota das emendas nacionais ordena pelo valor recebido na PB", async () => {
  const originals = [[prisma.emenda_nacional, "findMany"], [prisma.emenda_nacional_destino, "findMany"]]
    .map(([model, method]) => [model, method, model[method]]);
  const other = { ...amendment, codigo_emenda: "202650410001" };
  prisma.emenda_nacional.findMany = async () => [amendment, other];
  prisma.emenda_nacional_destino.findMany = async () => [
    recipient("municipal", 10), { ...recipient("municipal", 99), codigo_emenda: "202650410001" },
  ];
  const server = buildApp().listen(0);
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/emendas-nacionais?ano=2026`);
    const body = await response.json();
    assert.deepEqual(body.items.map((item) => item.codigoEmenda), ["202650410001", "202650410002"]);
    assert.equal(body.recebidoEntes, 109);
  } finally {
    server.close();
    for (const [model, method, original] of originals) model[method] = original;
  }
});
