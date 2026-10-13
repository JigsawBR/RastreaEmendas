import test from "node:test";
import assert from "node:assert/strict";
import { serializeCsv } from "../dist/shared/serialization/csv.js";
import { createStateAmendmentService } from "../dist/modules/state-amendments/application/state-amendment-service.js";
test("CSV mantém cabeçalhos vazios, ausência, zero e conteúdo com aspas", () => {
  assert.equal(serializeCsv(["valor"], []), "\uFEFFvalor");
  assert.equal(
    serializeCsv(["a", "b", "c"], [[null, 0, 'Texto "citado"']]),
    '\uFEFFa;b;c\n;"0";"Texto ""citado"""',
  );
  assert.match(serializeCsv(["texto"], [["=SUM(A1)"]]), /"'=SUM/);
});
test("serviço aceita repositório independente de Prisma e exclui execução órfã", async () => {
  const listing = {
    ano: 2024,
    numero_emenda: "0001",
    nome_deputado: "Teste",
    beneficiario_final: "Hospital",
    valor: 1000,
    data_envio: null,
    tipo: null,
    secretaria: null,
    objeto: null,
    tipo_entidade: null,
  };
  const execution = {
    ano: 2024,
    numero_emenda: "0001",
    valor_empenhado: 100,
    valor_liquidado: null,
    valor_pago: 0,
  };
  const orphan = { ...execution, numero_emenda: "9999", valor_empenhado: 999 };
  const repository = {
    list: async () => ({
      total: 1,
      listings: [listing],
      executions: [execution],
    }),
    summary: async () => ({
      listings: [listing],
      executions: [execution, orphan],
    }),
    find: async (year, number) =>
      year === 2024 && number === "0001"
        ? { listing, executions: [execution] }
        : null,
  };
  const service = createStateAmendmentService(repository);
  const summary = await service.summary(2024);
  assert.equal(summary.valorEmpenhado, 100);
  assert.equal(summary.valorPago, 0);
  assert.equal(summary.valorLiquidado, null);
  assert.equal(summary.linhasSemListagem, 1);
  const list = await service.list({ ano: 2024 });
  assert.equal(list.items[0].numeroEmenda, "0001");
  assert.equal(await service.detail(2025, "0001"), null);
  assert.equal(
    (await service.detail(2024, "0001")).rastreabilidade.score,
    null,
  );
});
