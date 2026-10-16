import assert from "node:assert/strict";
import { test } from "node:test";
import { groupExecutionValues } from "../dist/modules/federal-amendments/execution/application/group-execution-values.js";

test("distribuição distingue valores ausentes, zero e totais parciais por fase", () => {
  const document = (stage, committed, paid, unit = "123456") => ({
    estagio: stage, orgao_executor: unit, valor_empenhado: committed, valor_pago: paid,
  });
  const groups = groupExecutionValues([
    document("Empenho", 100, null), document("Empenho", null, null),
    document("Pagamento", null, 0), document("Pagamento", null, null),
    document("Liquidação", 999, 999), document("Empenho", null, null, "654321"),
  ]);
  assert.deepEqual(groups.get("123456"), {
    quantidade: 5, empenhado: 100, pago: 0, empenhosSemValor: 1, pagamentosSemValor: 1,
  });
  assert.equal(groups.get("654321").empenhado, null);
  assert.equal(groups.get("654321").pago, null);
});
