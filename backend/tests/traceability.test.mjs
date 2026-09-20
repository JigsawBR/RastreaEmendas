import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateTraceability } from "../dist/modules/traceability/domain/calculate-traceability.js";

test("calcula rastreabilidade completa com os cinco critérios do RF-08", () => {
  const result = calculateTraceability(
    [
      { estagio: "Empenho", orgao_executor: "123456" },
      { estagio: "Liquidação", orgao_executor: "123456" },
      { estagio: "Pagamento", orgao_executor: "123456" },
    ],
    [{ funcao: "Saúde" }],
  );

  assert.equal(result.score, 1);
  assert.equal(result.atendidos, 5);
  assert.equal(result.total, 5);
  assert.equal(result.criterios.every((criterio) => criterio.atendido), true);
});

test("não considera campos vazios como função ou órgão preenchidos", () => {
  const result = calculateTraceability(
    [{ estagio: "Empenho", orgao_executor: "   " }],
    [{ funcao: "" }],
  );

  assert.equal(result.score, 0.2);
  assert.deepEqual(
    result.criterios.filter((criterio) => criterio.atendido).map((criterio) => criterio.nome),
    ["empenho"],
  );
});
