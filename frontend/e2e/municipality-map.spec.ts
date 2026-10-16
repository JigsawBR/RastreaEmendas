import { test, expect } from "@playwright/test";

test("mapa municipal distingue origens, permite seleção e atualiza por exercício", async ({ page, request }, testInfo) => {
  await page.goto("/municipios");
  const map = page.getByRole("group", { name: "Mapa dos 223 municípios da Paraíba em 2024" });
  await expect(map.getByRole("button")).toHaveCount(223);
  await expect(map.getByRole("button", { name: "Cajazeiras — Federais e estaduais", exact: true })).toHaveClass(/map-both/);
  await expect(map.getByRole("button", { name: "Campina Grande — Federais", exact: true })).toHaveClass(/map-federal/);
  await expect(map.getByRole("button", { name: "João Pessoa — Estaduais", exact: true })).toHaveClass(/map-state/);
  await expect(map.getByRole("button", { name: "Sousa — Sem vínculo identificado", exact: true })).toHaveClass(/map-none/);
  await map.getByRole("button", { name: "Cajazeiras — Federais e estaduais", exact: true }).focus();
  await page.keyboard.press("Enter");
  const detail = page.getByRole("complementary", { name: "Detalhes do município" });
  await expect(detail.getByRole("heading", { name: "Cajazeiras", exact: true })).toBeVisible();
  await expect(detail.getByRole("link", { name: "Emenda estadual 0004" })).toHaveAttribute("href", "/emendas-estaduais/2024/0004");
  await page.getByLabel("Origem no mapa").selectOption("state");
  await expect(map.getByRole("button", { name: "Cajazeiras — Estaduais", exact: true })).toHaveClass(/map-state/);
  await expect(map.getByRole("button", { name: "Campina Grande — Sem vínculo identificado", exact: true })).toHaveClass(/map-none/);
  await page.getByLabel("Selecionar município").selectOption({ label: "João Pessoa" });
  await expect(page.locator(".map-active-label strong")).toHaveText("João Pessoa");
  await expect(detail.getByText("Município informado na nota de empenho", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator(".municipality-map-panel").screenshot({ path: `test-results/municipality-map-${testInfo.project.name}.png` });
  const response = await request.get("/api/municipios/mapa?ano=2024");
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.items).toHaveLength(223);
  await page.getByLabel("Exercício dos municípios").selectOption("2025");
  await expect(page.getByRole("group", { name: "Mapa dos 223 municípios da Paraíba em 2025" })).toBeVisible();
  await expect(detail.getByText(/Nenhum vínculo estadual com município explícito/)).toBeVisible();
  await expect(page.locator(".municipality-area.map-both, .municipality-area.map-federal, .municipality-area.map-state")).toHaveCount(0);
});

test("falha de dados não é apresentada como mapa sem recursos", async ({ page }) => {
  await page.route("**/api/municipios/mapa?*", route => route.fulfill({ status: 503, body: "temporarily unavailable" }));
  await page.goto("/municipios");
  await expect(page.locator(".municipality-map-panel").getByRole("button", { name: /Tentar novamente/ })).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".municipality-area")).toHaveCount(0);
});
