import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("consulta estadual aplica filtros, exporta CSV e preserva retorno", async ({
  page,
}) => {
  await page.goto("/emendas?origem=estadual&ano=2024");
  await expect(
    page.getByRole("heading", { name: "23 emendas encontradas" }),
  ).toBeVisible();
  await page.getByLabel("Beneficiário", { exact: true }).fill("Hospital E2E");
  await page.getByLabel("Parlamentar", { exact: true }).fill("Estadual");
  await page.getByLabel("Função", { exact: true }).fill("Saúde");
  await page.getByLabel("Órgão executor", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(
    page.getByRole("heading", { name: "1 emendas encontradas" }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Exportar CSV" }).click();
  const download = await downloadPromise;
  const csv = await readFile((await download.path())!, "utf8");
  expect(csv).toContain("Hospital E2E");
  expect(csv).not.toContain("Associação E2E");
  expect(csv).toContain("1000");
  await page
    .getByRole("link", { name: /Ver detalhe/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Emenda estadual 0001", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("RF-08 · não avaliável nesta base"),
  ).toBeVisible();
  await expect(
    page.getByText("Pagamento informado · soma parcial"),
  ).toBeVisible();
  await page.getByRole("link", { name: /Voltar à consulta filtrada/ }).click();
  await expect(page.getByLabel("Beneficiário", { exact: true })).toHaveValue(
    "Hospital E2E",
  );
  await expect(page.getByLabel("Função", { exact: true })).toHaveValue("Saúde");
  await expect(
    page.getByRole("heading", { name: "1 emendas encontradas" }),
  ).toBeVisible();
});
test("paginação e troca de origem preservam a consulta coerente", async ({
  page,
}) => {
  await page.goto("/emendas?origem=estadual&ano=2024");
  await expect(page.getByText("Página 1 de 2 · 23 resultados")).toBeVisible();
  await page.getByRole("button", { name: "Próxima", exact: true }).click();
  await expect(page.getByText("Página 2 de 2 · 23 resultados")).toBeVisible();
  await page
    .getByRole("link", { name: /Ver detalhe/ })
    .first()
    .click();
  await page.getByRole("link", { name: /Voltar à consulta filtrada/ }).click();
  await expect(page.getByText("Página 2 de 2 · 23 resultados")).toBeVisible();
  await page.getByLabel("Origem da emenda").selectOption("federal");
  await expect(page.getByLabel("Município", { exact: true })).toBeVisible();
  await expect(page.getByText("Página 1 de 2 · 23 resultados")).toBeVisible();
  await expect(page.getByLabel("Beneficiário", { exact: true })).toHaveCount(0);
});
test("cadeia federal apresenta documentos e completude real", async ({
  page,
}) => {
  await page.goto("/emendas/202499900001");
  await expect(
    page.getByRole("heading", { name: "Emenda 0001", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/100.*5 de 5 critérios presentes/)).toBeVisible();
  await page.getByRole("button", { name: /Empenho/ }).click();
  await expect(
    page.getByRole("heading", { name: "Documentos de empenho" }),
  ).toBeVisible();
  await expect(page.locator("#phase-documents")).toContainText(
    "999001000012024NE000001",
  );
  await page.goto("/emendas/202499900002");
  await expect(page.getByText(/60.*3 de 5 critérios presentes/)).toBeVisible();
});
test("ausência, zero e identidade por exercício são distintos", async ({
  page,
}) => {
  await page.goto("/emendas-estaduais/2024/0002");
  await expect(
    page.getByText(/Nenhuma linha de execução foi vinculada/),
  ).toBeVisible();
  await expect(page.locator(".metrics")).toContainText("Não informado");
  await page.goto("/emendas-estaduais/2024/0003");
  await expect(page.locator(".metrics")).toContainText("R$");
  await expect(page.locator(".metrics")).not.toContainText("Não informado");
  await page.goto("/emendas-estaduais/2025/0001");
  await expect(
    page.getByText("Beneficiário 2025 E2E", { exact: false }),
  ).toBeVisible();
});
test("resumo, cobertura e exercício sem registros", async ({ page }) => {
  await page.goto("/?origem=estadual&ano=2024");
  await expect(page.locator(".metrics")).toContainText("23");
  await expect(
    page.getByText(/1 linhas de execução sem correspondência/),
  ).toBeVisible();
  await page.getByRole("link", { name: "Consultar emendas" }).click();
  await expect(page.getByLabel("Origem da emenda")).toHaveValue("estadual");
  await page.goto("/emendas?origem=estadual&ano=2023");
  await expect(
    page.getByText(/O exercício não tem registros na base carregada/),
  ).toBeVisible();
  await page.goto("/sobre-os-dados?origem=estadual&ano=2024");
  await expect(
    page.getByRole("heading", { name: /dados/i }).first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("API real valida filtros, totais e isolamento anual", async ({
  request,
}) => {
  const filtered = await request.get(
    "/api/estaduais/emendas?ano=2024&beneficiario=Hospital&funcao=Saúde&orgao=100",
  );
  expect(filtered.status()).toBe(200);
  const list = await filtered.json();
  expect(list.total).toBe(1);
  expect(list.items[0].valorEmpenhado).toBe(1000);
  const detail = await request.get("/api/estaduais/emendas/2024/0001");
  const item = await detail.json();
  expect(item.valorEmpenhado).toBe(3000);
  expect(item.valorPago).toBe(300);
  const summary = await (
    await request.get("/api/estaduais/resumo?ano=2024")
  ).json();
  expect(summary.totalEmendas).toBe(23);
  expect(summary.linhasSemListagem).toBe(1);
  expect(summary.valorEmpenhado).toBe(23000);
  expect((await request.get("/api/estaduais/emendas?ano=abc")).status()).toBe(
    400,
  );
  expect((await request.get("/api/estaduais/emendas/2024/9999")).status()).toBe(
    404,
  );
});
test("consulta federal reutiliza filtros no CSV e no detalhe", async ({
  page,
}) => {
  await page.goto("/emendas?origem=federal&ano=2024");
  await page.getByLabel("Município", { exact: true }).fill("CAJAZEIRAS");
  await page.getByLabel("Parlamentar", { exact: true }).fill("Federal");
  await page.getByLabel("Função", { exact: true }).fill("Saúde");
  await page.getByLabel("Órgão executor", { exact: true }).fill("999001");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(
    page.getByRole("heading", { name: "23 emendas encontradas" }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Exportar CSV" }).click();
  const csv = await readFile((await (await downloadPromise).path())!, "utf8");
  expect(csv).toContain("202499900001");
  expect(csv.split("\n")).toHaveLength(24);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("link", { name: /Ver detalhe/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Emenda 0001", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Voltar à consulta filtrada/ }).click();
  await expect(page.getByLabel("Município", { exact: true })).toHaveValue(
    "CAJAZEIRAS",
  );
});
