import { test, expect } from "@playwright/test";

test("mapa municipal distingue origens, permite seleção e atualiza por exercício", async ({ page, request }, testInfo) => {
  await page.goto("/municipios");
  const map = page.getByRole("group", { name: "Mapa dos 223 municípios da Paraíba em 2024" });
  await expect(map.getByRole("button")).toHaveCount(223);
  // Default indicator: state commitment transferred to the city, by intensity.
  await expect(map.getByRole("button", { name: /^Cajazeiras — R\$\s100 transferidos$/ })).toHaveClass(/map-state-5/);
  await expect(map.getByRole("button", { name: "João Pessoa — Sem valor neste indicador", exact: true })).toHaveClass(/map-none/);
  await expect(page.locator(".map-legend")).toContainText("Sem valor");
  await page.getByLabel("Indicador no mapa").selectOption("despesa");
  await expect(map.getByRole("button", { name: /^Campina Grande — R\$\s50 empenhados$/ })).toHaveClass(/map-federal-5/);
  await expect(map.getByRole("button", { name: "Cajazeiras — Sem valor neste indicador", exact: true })).toHaveClass(/map-none/);
  await page.getByLabel("Indicador no mapa").selectOption("presenca");
  await expect(map.getByRole("button", { name: "Cajazeiras — Federais e estaduais", exact: true })).toHaveClass(/map-both/);
  await expect(map.getByRole("button", { name: "Campina Grande — Federais", exact: true })).toHaveClass(/map-federal/);
  await expect(map.getByRole("button", { name: "João Pessoa — Sem vínculo identificado", exact: true })).toHaveClass(/map-none/);
  await expect(map.getByRole("button", { name: "Sousa — Sem vínculo identificado", exact: true })).toHaveClass(/map-none/);
  await map.getByRole("button", { name: "Cajazeiras — Federais e estaduais", exact: true }).focus();
  await page.keyboard.press("Enter");
  const detail = page.getByRole("complementary", { name: "Detalhes do município" });
  await expect(detail.getByRole("heading", { name: "Cajazeiras", exact: true })).toBeVisible();
  await expect(detail.getByRole("link", { name: "Emenda estadual 0004" })).toHaveAttribute("href", "/emendas-estaduais/2024/0004");
  await expect(detail.getByText("Transferência ao município na nota de empenho", { exact: true })).toBeVisible();
  await expect(detail.getByRole("link", { name: "Consultar emendas estaduais do município →" })).toHaveAttribute("href", "/emendas?origem=estadual&ano=2024&municipio=Cajazeiras");
  await expect(detail.getByText("Empenho transferido", { exact: true })).toBeVisible();
  await page.getByLabel("Indicador no mapa").selectOption("estadual");
  await expect(map.getByRole("button", { name: "Campina Grande — Sem valor neste indicador", exact: true })).toHaveClass(/map-none/);
  await page.getByLabel("Selecionar município").selectOption({ label: "João Pessoa" });
  await expect(page.locator(".map-active-label strong")).toHaveText("João Pessoa");
  await expect(detail.getByText(/Recursos a entidades sediadas aqui não são atribuídos à cidade/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator(".municipality-map-panel").screenshot({ path: `test-results/municipality-map-${testInfo.project.name}.png` });
  const response = await request.get("/api/municipios/mapa?ano=2024");
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.items).toHaveLength(223);
  await page.getByLabel("Exercício dos municípios").selectOption("2025");
  await expect(page.getByRole("group", { name: "Mapa dos 223 municípios da Paraíba em 2025" })).toBeVisible();
  await expect(detail.getByText(/Nenhuma transferência estadual a este município/)).toBeVisible();
  await expect(page.locator(".municipality-area:not(.map-none)")).toHaveCount(0);
});

test("falha de dados não é apresentada como mapa sem recursos", async ({ page }) => {
  await page.route("**/api/municipios/mapa?*", route => route.fulfill({ status: 503, body: "temporarily unavailable" }));
  await page.goto("/municipios");
  await expect(page.locator(".municipality-map-panel").getByRole("button", { name: /Tentar novamente/ })).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".municipality-area")).toHaveCount(0);
});
