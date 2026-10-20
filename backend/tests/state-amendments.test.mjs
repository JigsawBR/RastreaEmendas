import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../dist/app.js";
import { prisma } from "../dist/shared/infrastructure/database/prisma.js";
import {
  sumStateValues,
  groupStateValues,
} from "../dist/modules/state-amendments/domain/state-values.js";
function execution(ano, numero, committed, liquidated, paid, extra = {}) {
  return {
    id: 1,
    ano,
    numero_emenda: numero,
    codigo_orgao: "100",
    nome_orgao: "Saúde",
    funcao: "Saúde",
    subfuncao: null,
    programa: null,
    acao: null,
    unidade_orcamentaria: null,
    natureza_despesa: null,
    valor_empenhado: committed,
    valor_liquidado: liquidated,
    valor_pago: paid,
    ...extra,
  };
}
test("valores estaduais preservam zero, ausência e somas parciais", () => {
  assert.deepEqual(sumStateValues([]), {
    valorEmpenhado: null,
    valorLiquidado: null,
    valorPago: null,
    valoresAusentes: { empenhado: 0, liquidado: 0, pago: 0 },
    totalLinhasExecucao: 0,
  });
  const result = sumStateValues([
    execution(2024, "001", 100, null, 0),
    execution(2024, "001", null, null, 20),
  ]);
  assert.equal(result.valorEmpenhado, 100);
  assert.equal(result.valorLiquidado, null);
  assert.equal(result.valorPago, 20);
  assert.equal(result.valoresAusentes.empenhado, 1);
  const grouped = groupStateValues(
    [
      execution(2024, "001", 100, 50, 20),
      execution(2024, "001", 20, 10, 0, {
        codigo_orgao: "200",
        nome_orgao: "Saúde",
      }),
    ],
    "organization",
  );
  assert.equal(
    grouped.length,
    2,
    "nomes iguais com códigos distintos não podem ser fundidos",
  );
});
function matches(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (key === "OR") return value.some((condition) => matches(row, condition));
    if (key === "AND")
      return value.every((condition) => matches(row, condition));
    if (value && typeof value === "object") {
      if ("contains" in value)
        return (
          row[key] != null &&
          String(row[key]).toLowerCase().includes(value.contains.toLowerCase())
        );
      if ("equals" in value) return row[key] === value.equals;
      if ("in" in value) return value.in.includes(row[key]);
    }
    return row[key] === value;
  });
}
test("API estadual filtra, pagina, exporta e distingue a identidade por exercício", async () => {
  const listings = [
    {
      id: 1,
      ano: 2024,
      numero_emenda: "001",
      nome_deputado: "Ana",
      beneficiario_final: "Associação",
      valor: 100,
      tipo: "Individual",
      secretaria: "Saúde",
      objeto: "Objeto 1",
      data_envio: null,
      tipo_entidade: null,
    },
    {
      id: 2,
      ano: 2025,
      numero_emenda: "001",
      nome_deputado: "Bruno",
      beneficiario_final: "Hospital",
      valor: 500,
      tipo: "Individual",
      secretaria: "Saúde",
      objeto: "Objeto 2",
      data_envio: null,
      tipo_entidade: null,
    },
    {
      id: 3,
      ano: 2024,
      numero_emenda: "002",
      nome_deputado: "Ana",
      beneficiario_final: "Hospital",
      valor: 200,
      tipo: "Individual",
      secretaria: "Saúde",
      objeto: "Objeto 3",
      data_envio: null,
      tipo_entidade: null,
    },
  ];
  const executions = [
    execution(2025, "001", 0, 0, 0),
    execution(2024, "002", 100, null, 30, { id: 2 }),
    execution(2024, "002", 50, 40, 20, {
      id: 3,
      funcao: "Educação",
      nome_orgao: "Educação",
      codigo_orgao: "200",
    }),
    execution(2024, "099", 900, 900, 900, { id: 4 }),
  ];
  const destination = (number, kind, ibge, value, extra = {}) => ({
    year: 2024, amendment_number: number, creditor_document: "1", creditor_name: "Credor",
    application_modality: kind === "municipal_transfer" ? "40" : "50", destination: kind,
    creditor_municipality: null, creditor_municipality_ibge: ibge, committed_value: value, note_count: 1, ...extra,
  });
  const destinations = [
    destination("2", "municipal_transfer", "2503704", 100, { creditor_name: "PREFEITURA MUNICIPAL DE CAJAZEIRAS" }),
    destination("2", "private_nonprofit", "2507507", 50),
  ];
  const originals = [];
  function stub(model, method, fn) {
    originals.push([model, method, model[method]]);
    model[method] = fn;
  }
  stub(prisma.state_expense_document, "findMany", async () => []);
  stub(prisma.state_expense_import, "findMany", async () => []);
  stub(prisma.state_amendment_destination, "findMany", async ({ where, select }) =>
    destinations
      .filter((r) => matches(r, where))
      .map((row) =>
        select
          ? Object.fromEntries(Object.keys(select).map((key) => [key, row[key]]))
          : row,
      ),
  );
  stub(
    prisma.emenda_estadual,
    "count",
    async ({ where }) => listings.filter((r) => matches(r, where)).length,
  );
  stub(prisma.emenda_estadual, "findMany", async ({ where = {}, take, skip = 0 }) =>
    listings
      .filter((r) => matches(r, where))
      .sort(
        (a, b) =>
          b.ano - a.ano || a.numero_emenda.localeCompare(b.numero_emenda),
      )
      .slice(skip, take ? skip + take : undefined),
  );
  stub(
    prisma.emenda_estadual,
    "findUnique",
    async ({ where }) =>
      listings.find((r) => matches(r, where.ano_numero_emenda)) ?? null,
  );
  stub(prisma.emenda_estadual_execucao, "findMany", async ({ where, select }) =>
    executions
      .filter((r) => matches(r, where))
      .map((row) =>
        select
          ? Object.fromEntries(
              Object.keys(select).map((key) => [key, row[key]]),
            )
          : row,
      ),
  );
  const server = buildApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const get = (endpoint) =>
    fetch("http://127.0.0.1:" + server.address().port + endpoint);
  const json = async (endpoint) => {
    const r = await get(endpoint);
    assert.equal(r.status, 200, endpoint);
    return r.json();
  };
  try {
    const all = await json("/estaduais/emendas?limit=1&offset=1");
    assert.equal(all.total, 3);
    assert.equal(all.items.length, 1);
    assert.equal(all.items[0].ano, 2024);
    const noExecution = await json("/estaduais/emendas/2024/001");
    assert.equal(noExecution.valorPago, null);
    assert.equal(noExecution.totalLinhasExecucao, 0);
    assert.equal(noExecution.rastreabilidade.score, null);
    const zero = await json("/estaduais/emendas/2025/001");
    assert.equal(zero.valorPago, 0);
    assert.equal(zero.totalLinhasExecucao, 1);
    const combined = await json(
      "/estaduais/emendas?ano=2024&parlamentar=ana&beneficiario=hospital&funcao=Sa%C3%BAde&orgao=100",
    );
    assert.equal(combined.total, 1);
    assert.equal(combined.items[0].numeroEmenda, "002");
    assert.equal(
      combined.items[0].valorEmpenhado,
      100,
      "totais limitados à execução correspondente aos filtros",
    );
    const noMatch = await json("/estaduais/emendas?funcao=Inexistente");
    assert.equal(noMatch.total, 0);
    const sameRow = await json(
      "/estaduais/emendas?funcao=Sa%C3%BAde&orgao=200",
    );
    assert.equal(
      sameRow.total,
      0,
      "função e órgão devem corresponder à mesma linha",
    );
    const summary = await json("/estaduais/resumo?ano=2024");
    assert.equal(summary.totalEmendas, 2);
    assert.equal(summary.valorEmpenhado, 150);
    assert.equal(summary.emendasSemExecucao, 1);
    assert.equal(summary.linhasSemListagem, 1);
    assert.equal(summary.taxaExecucao, null);
    const allSummary = await json("/estaduais/resumo");
    assert.equal(allSummary.totalEmendas, 3);
    assert.equal(
      allSummary.valorDestinado,
      800,
      "valor destinado usa listagem sem multiplicar por linhas de execução",
    );
    for (const municipio of ["Cajazeiras", "2503704", "cajazeiras"]) {
      const located = await json("/estaduais/emendas?municipio=" + municipio);
      assert.equal(located.total, 1, municipio);
      assert.equal(located.items[0].numeroEmenda, "002");
      assert.deepEqual(located.items[0].localidades, ["Cajazeiras"]);
    }
    assert.equal(
      (await json("/estaduais/emendas?municipio=Jo%C3%A3o%20Pessoa")).total,
      0,
      "sede de entidade privada não é município beneficiado",
    );
    assert.equal((await json("/estaduais/emendas?ano=2025&municipio=Cajazeiras")).total, 0);
    assert.equal(
      (await json("/estaduais/emendas?municipio=Cajazeiras&funcao=Educa%C3%A7%C3%A3o")).total,
      1,
      "município e função combinam por AND",
    );
    const detail = await json("/estaduais/emendas/2024/002");
    assert.deepEqual(detail.municipiosBeneficiados, ["Cajazeiras"]);
    assert.equal(detail.destinos.length, 2);
    assert.equal(detail.destinos.find((d) => d.destino === "private_nonprofit").municipioBeneficiado, null);
    assert.equal(detail.destinos.find((d) => d.destino === "private_nonprofit").municipioCredor, "João Pessoa");
    const step = detail.trajeto.find((s) => s.codigo === "destination");
    assert.ok(step.evidencias.some((e) => e.includes("Cajazeiras")));
    assert.match(step.lacuna, /sede/);
    assert.deepEqual(summary.destinos.emendasComMunicipioBeneficiado, 1);
    assert.deepEqual(
      summary.destinos.porDestino.map((d) => [d.destino, d.emendas, d.valorEmpenhadoLiquido]),
      [["municipal_transfer", 1, 100], ["private_nonprofit", 1, 50]],
    );
    const empty = await json("/estaduais/resumo?ano=2026");
    assert.equal(empty.totalEmendas, 0);
    assert.equal(empty.valorPago, null);
    const csv = await get(
      "/estaduais/export/emendas?ano=2024&parlamentar=ana&beneficiario=hospital&funcao=Sa%C3%BAde&orgao=100",
    );
    assert.equal(csv.status, 200);
    const text = await csv.text();
    assert.equal(text.trim().split("\n").length, 2);
    assert.ok(text.includes('"estadual";"CODATA";"2024";"002"'));
    assert.ok(text.includes('"Hospital";"Cajazeiras"'), "CSV inclui municípios beneficiados");
    assert.ok(
      text.includes(';"100";;"30";'),
      "CSV preserva valores ausentes vazios",
    );
    for (const query of [
      "ano=abc",
      "offset=-1",
      "limit=0",
      "beneficiario=a&beneficiario=b",
      "municipio=Inexistente",
      "municipio=",
    ])
      assert.equal(
        (await get("/estaduais/emendas?" + query)).status,
        400,
        query,
      );
    assert.equal((await get("/estaduais/emendas/no/001")).status, 400);
    assert.equal((await get("/estaduais/emendas/2026/001")).status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    for (const [model, method, original] of originals) model[method] = original;
    await prisma.$disconnect();
  }
});
