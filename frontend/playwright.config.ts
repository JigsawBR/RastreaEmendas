import { defineConfig, devices } from "@playwright/test";
if (!process.env.E2E_SCHEMA?.startsWith("rastrea_e2e_"))
  throw new Error("Execute npm run test:e2e para preparar o banco isolado.");
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: [
    {
      command: "node ../backend/dist/server.js",
      url: process.env.E2E_API_URL + "/health",
      reuseExistingServer: false,
      env: {
        DATABASE_URL: process.env.DATABASE_URL!,
        PORT: process.env.E2E_API_PORT!,
      },
    },
    {
      command:
        "npm run dev -- --host 127.0.0.1 --port " +
        process.env.E2E_UI_PORT +
        " --strictPort",
      url: process.env.E2E_BASE_URL,
      reuseExistingServer: false,
      env: { API_TARGET: process.env.E2E_API_URL! },
    },
  ],
});
