import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { seedDatabase } from "../e2e/seed.mjs";
const frontend = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const backend = path.resolve(frontend, "../backend");
const require = createRequire(path.join(backend, "package.json"));
require("dotenv").config({ path: path.join(backend, ".env"), quiet: true });
const { PrismaClient } = require("@prisma/client");
const source = process.env.E2E_DATABASE_URL || process.env.DATABASE_URL;
if (!source)
  throw new Error(
    "Configure E2E_DATABASE_URL ou backend/.env com PostgreSQL real.",
  );
const url = new URL(source);
if (!["postgresql:", "postgres:"].includes(url.protocol))
  throw new Error("E2E exige PostgreSQL real.");
const schema =
  "rastrea_e2e_" + process.pid + "_" + randomBytes(6).toString("hex");
if (!/^rastrea_e2e_[0-9]+_[a-f0-9]{12}$/.test(schema))
  throw new Error("Schema inválido.");
url.searchParams.set("schema", schema);
const isolated = url.toString();
const admin = new PrismaClient({ datasources: { db: { url: source } } });
let created = false,
  fixture;
const redact = (text) =>
  text
    .replaceAll(source, "[DATABASE_URL]")
    .replaceAll(isolated, "[E2E_DATABASE_URL]");
async function run(file, args, env = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file, ...args], {
      cwd: frontend,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (data) =>
      process.stdout.write(redact(data.toString())),
    );
    child.stderr.on("data", (data) =>
      process.stderr.write(redact(data.toString())),
    );
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error("Comando terminou com código " + code)),
    );
  });
}
async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return String(port);
}
async function snapshot() {
  const tables = await admin.$queryRawUnsafe(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() ORDER BY table_name",
  );
  const counts = {};
  for (const table of [
    "emenda",
    "emenda_alocacao",
    "documento_despesa",
    "emenda_estadual",
    "emenda_estadual_execucao",
  ]) {
    if (tables.some((row) => row.table_name === table)) {
      const [row] = await admin.$queryRawUnsafe(
        'SELECT count(*)::text AS total FROM "' + table + '"',
      );
      counts[table] = row.total;
    }
  }
  return { tables, counts };
}
let failure;
let before;
try {
  before = await snapshot();
  await admin.$executeRawUnsafe('CREATE SCHEMA "' + schema + '"');
  created = true;
  console.log("E2E: PostgreSQL real, schema temporário " + schema);
  await run(
    path.join(backend, "node_modules/prisma/build/index.js"),
    [
      "db",
      "push",
      "--schema",
      path.join(backend, "prisma/schema.prisma"),
      "--skip-generate",
    ],
    { DATABASE_URL: isolated },
  );
  fixture = new PrismaClient({ datasources: { db: { url: isolated } } });
  await seedDatabase(fixture);
  await fixture.$disconnect();
  await run(process.env.npm_execpath, ["--prefix", backend, "run", "build"]);
  const apiPort = await freePort(),
    uiPort = await freePort();
  await run(
    path.join(frontend, "node_modules/@playwright/test/cli.js"),
    ["test", ...process.argv.slice(2)],
    {
      DATABASE_URL: isolated,
      E2E_SCHEMA: schema,
      E2E_API_PORT: apiPort,
      E2E_UI_PORT: uiPort,
      E2E_API_URL: "http://127.0.0.1:" + apiPort,
      E2E_BASE_URL: "http://127.0.0.1:" + uiPort,
    },
  );
} catch (error) {
  failure = error;
} finally {
  await fixture?.$disconnect();
  if (created)
    await admin.$executeRawUnsafe('DROP SCHEMA "' + schema + '" CASCADE');
  // Verifica tabelas e contagens exatas da base original.
  if (before) {
    const after = await snapshot();
    assert.deepEqual(after, before);
  }
  await admin.$disconnect();
  console.log(
    "E2E: schema temporário removido; tabelas originais preservadas.",
  );
}
if (failure) {
  console.error(redact(failure.message));
  process.exitCode = 1;
}
