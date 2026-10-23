import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAmendmentOrder, sortAmendments } from "../dist/shared/ordering/amendment-order.js";
import { buildApp } from "../dist/app.js";
import { prisma } from "../dist/shared/infrastructure/database/prisma.js";

const item = (id, empenhado, pago, atendidos) =>
  ({ id, valorEmpenhado: empenhado, valorPago: pago, rastreabilidade: { atendidos } });

test("ordenação põe valores ausentes no fim e preserva empates", () => {
  const items = [item("a", 100, 10, 5), item("b", null, null, null), item("c", 300, 0, 2), item("d", 100, 100, 2), item("e", 0, 0, 3)];
  const ids = order => sortAmendments(items, order).map(i => i.id).join("");
  assert.equal(ids("recentes"), "abcde");
  assert.equal(ids("empenhado"), "cadeb", "maior primeiro; empate mantém a ordem; ausente no fim");
  assert.equal(ids("pago"), "daceb");
  assert.equal(ids("execucao"), "cadbe", "menor execução primeiro; sem empenhado positivo não há percentual");
  assert.equal(ids("rastreabilidade"), "cdeab", "menos critérios primeiro; não avaliável no fim");
  assert.equal(parseAmendmentOrder("pago"), "pago");
  assert.equal(parseAmendmentOrder("qualquer"), "recentes");
});

test("lista federal traz RF-08 por emenda e ordena antes de paginar", async () => {
  const originals = [];
  const stub = (model, method, fn) => { originals.push([model, method, model[method]]); model[method] = fn; };
  const allocation = (funcao, empenhado, pago) =>
    ({ localidade_gasto: "CAJAZEIRAS - PB", funcao, valor_empenhado: empenhado, valor_liquidado: 0, valor_pago: pago });
  const rows = [
    { codigo_emenda: "A", ano: 2024, tipo_emenda: null, numero_emenda: "0001", nome_autor: "X", autor: null, emenda_alocacao: [allocation("Saúde", 100, 10)] },
    { codigo_emenda: "B", ano: 2024, tipo_emenda: null, numero_emenda: "0002", nome_autor: "Y", autor: null, emenda_alocacao: [allocation("", 50, 50)] },
  ];
  let findArgs;
  stub(prisma.emenda, "count", async () => rows.length);
  stub(prisma.emenda, "findMany", async args => { findArgs = args; return args.take ? rows.slice(args.skip, args.skip + args.take) : rows; });
  stub(prisma.documento_despesa, "groupBy", async () => [
    { codigo_emenda: "A", estagio: "Empenho", orgao_executor: "123456" },
    { codigo_emenda: "A", estagio: "Liquidação", orgao_executor: "123456" },
    { codigo_emenda: "A", estagio: "Pagamento", orgao_executor: "123456" },
    { codigo_emenda: "B", estagio: "Empenho", orgao_executor: null },
  ]);
  stub(prisma.emenda_alocacao, "groupBy", async () => [
    { codigo_emenda: "A", funcao: "Saúde" }, { codigo_emenda: "B", funcao: "" },
  ]);
  const server = buildApp().listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const get = async path => (await fetch(`http://127.0.0.1:${server.address().port}${path}`)).json();
  try {
    const recent = await get("/emendas?limit=1");
    assert.equal(findArgs.take, 1, "ordem padrão continua paginando no banco");
    assert.deepEqual(recent.items[0].rastreabilidade, { atendidos: 5, total: 5 });
    const paid = await get("/emendas?limit=1&ordem=pago");
    assert.equal(findArgs.take, undefined, "ordenação por valor busca todas antes de paginar");
    assert.equal(paid.total, 2);
    assert.equal(paid.ordem, "pago");
    assert.equal(paid.items[0].codigoEmenda, "B");
    const trace = await get("/emendas?ordem=rastreabilidade");
    assert.deepEqual(trace.items.map(i => [i.codigoEmenda, i.rastreabilidade.atendidos]), [["B", 1], ["A", 5]]);
    for (const query of ["ordem=valor", "ordem=pago&ordem=empenhado"])
      assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/emendas?${query}`)).status, 400, query);
  } finally {
    await new Promise(resolve => server.close(resolve));
    for (const [model, method, original] of originals) model[method] = original;
    await prisma.$disconnect();
  }
});
