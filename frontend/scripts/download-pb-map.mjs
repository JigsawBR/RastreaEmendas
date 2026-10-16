// Refresh the checked-in, self-contained Paraíba map from IBGE public APIs.
import { mkdir, readFile, writeFile } from "node:fs/promises";
const root = new URL("../../", import.meta.url);
const geometryUrl = "https://servicodados.ibge.gov.br/api/v3/malhas/estados/25?formato=application/vnd.geo%2Bjson&qualidade=minima&intrarregiao=municipio";
const namesUrl = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/25/municipios";
async function get(url) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(90000) });
      if (!response.ok) throw new Error(`IBGE: HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt));
    }
  }
}
const [geometry, municipalities] = process.argv.includes("--from-local")
  ? await Promise.all(["geometry", "names"].map(async name => JSON.parse(await readFile(new URL(`tmp/ibge/${name}.json`, root), "utf8"))))
  : await Promise.all([get(geometryUrl), get(namesUrl)]);
const names = new Map(municipalities.map(row => [String(row.id), row.nome]));
if (names.size !== 223 || geometry.type !== "FeatureCollection" || geometry.features.length !== 223) throw new Error("Malha PB incompleta");
for (const feature of geometry.features) {
  const code = String(feature.properties.codarea ?? feature.properties.CD_MUN ?? feature.id);
  if (!names.has(code) || !["Polygon", "MultiPolygon"].includes(feature.geometry?.type)) throw new Error("Município sem identificação IBGE");
  feature.properties = { code, name: names.get(code) };
}
if (new Set(geometry.features.map(feature => feature.properties.code)).size !== 223) throw new Error("Municípios repetidos na malha");
geometry.source = { name: "IBGE · API de Malhas v3, qualidade mínima", geometryUrl, namesUrl, collectedAt: new Date().toISOString() };
await mkdir(new URL("frontend/public/maps/", root), { recursive: true });
await mkdir(new URL("backend/src/shared/territory/", root), { recursive: true });
await writeFile(new URL("frontend/public/maps/paraiba.geojson", root), JSON.stringify(geometry));
await writeFile(new URL("backend/src/shared/territory/municipality-catalog.ts", root), `// Generated from IBGE by frontend/scripts/download-pb-map.mjs.\nexport const pbMunicipalities: readonly (readonly [string, string])[] = ${JSON.stringify([...names].sort())};\n`);
console.log(`Malha IBGE salva: ${geometry.features.length} municípios / ${JSON.stringify(geometry).length} caracteres`);
