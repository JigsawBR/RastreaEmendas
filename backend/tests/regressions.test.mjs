import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../dist/app.js";
import { prisma } from "../dist/shared/infrastructure/database/prisma.js";

test("query validation, executor filters and missing traceability", async () => {
  const originals = [];
  const stub = (model, method, implementation) => {
    originals.push([model, method, model[method]]);
    model[method] = implementation;
  };
  let listWhere, exportWhere;
  stub(prisma.unidade_gestora, "findMany", async ({ where }) => {
    assert.equal(where.OR[2].nome.contains, "Hospital");
    return [{ codigo: "123456" }];
  });
  stub(prisma.emenda, "count", async ({ where }) => { listWhere = where; return 0; });
  stub(prisma.emenda, "findMany", async ({ where }) => { exportWhere = where; return []; });
  stub(prisma.emenda, "findUnique", async ({ where }) =>
    where.codigo_emenda === "exists" ? { codigo_emenda: "exists" } : null);
  let documents = [];
  stub(prisma.documento_despesa, "findMany", async () => documents);
  stub(prisma.emenda_alocacao, "findMany", async () => []);
  const server = buildApp().listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const get = path => fetch(`http://127.0.0.1:${server.address().port}${path}`);
  try {
    for (const query of ["limit=abc", "offset=-1", "limit=0", "offset=1.5", "ano=abc",
      "ano=", "ano=2024&ano=2025", "orgao=a&orgao=b", "offset=9007199254740992"]) {
      assert.equal((await get(`/emendas?${query}`)).status, 400, query);
    }
    assert.equal((await get("/export/emendas?ano=abc")).status, 400);
    assert.equal((await get("/resumo?ano=abc")).status, 400);
    assert.equal((await get("/emendas/missing/rastreabilidade")).status, 404);
    assert.equal((await get("/emendas/missing/cadeia")).status, 404);
    assert.equal((await get("/emendas/missing/distribuicao")).status, 404);
    const chain = await (await get("/emendas/exists/cadeia")).json();
    assert.deepEqual(chain.estagios.map(item => [item.estagio, item.quantidade]), [
      ["Empenho", 0], ["Liquidação", 0], ["Pagamento", 0],
    ]);
    const existing = await get("/emendas/exists/rastreabilidade");
    assert.equal(existing.status, 200);
    assert.equal((await existing.json()).score, 0);
    assert.equal((await get("/emendas?ano=2024&orgao=Hospital&offset=0")).status, 200);
    assert.deepEqual(listWhere.documento_despesa.some.orgao_executor.in, ["Hospital", "123456"]);
    const expected = structuredClone(listWhere);
    assert.equal((await get("/export/emendas?ano=2024&orgao=Hospital")).status, 200);
    assert.deepEqual(exportWhere, expected);
    documents = [
      { destino_recurso: null, nome_favorecido: null, municipio_favorecido: null, valor_documento: null },
      { destino_recurso: "municipio", nome_favorecido: "Município", municipio_favorecido: "CAJAZEIRAS", uf_favorecido: "PB", valor_documento: 0 },
      { destino_recurso: "privado", nome_favorecido: "Fornecedor", municipio_favorecido: "SÃO BENTO", uf_favorecido: "sp", valor_documento: 10 },
    ];
    const destination = await (await get("/emendas/exists/destino")).json();
    const missing = destination.grupos.find(group => group.destino === "nao_informado");
    const zero = destination.grupos.find(group => group.destino === "municipio");
    assert.equal(missing.missingValueCount, 1);
    assert.deepEqual(missing.favorecidos, []);
    assert.equal(zero.missingValueCount, 0);
    assert.equal(zero.favorecidos[0].valor, 0);
    assert.equal(zero.favorecidos[0].codigoIbge, "2503704", "favorecido da PB recebe o código IBGE");
    const supplier = destination.grupos.find(group => group.destino === "privado").favorecidos[0];
    assert.equal(supplier.uf, "SP");
    assert.equal(supplier.codigoIbge, null, "homônimo de outro estado não vai para o mapa da PB");
  } finally {
    await new Promise(resolve => server.close(resolve));
    for (const [model, method, original] of originals) model[method] = original;
    await prisma.$disconnect();
  }
});
