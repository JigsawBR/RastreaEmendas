import { pbMunicipalities } from "../../../shared/territory/municipality-catalog.js";
import { municipalityKey } from "../../../shared/territory/municipalities.js";

export { municipalityKey };
const names = new Map(pbMunicipalities.map(([code, name]) => [municipalityKey(name), code]));
const officialNames = new Map(pbMunicipalities);
const positive = (value: unknown) => Number(value ?? 0) > 0;
type Allocation = { localidade_gasto: string; codigo_emenda: string; valor_empenhado: unknown; valor_pago: unknown };
type Plan = { nome_beneficiario: string | null; valor_custeio: unknown; valor_investimento: unknown };
type Expense = { municipio: string | null; valor_empenhado: unknown; valor_pago: unknown };
type StateListing = { ano: number; numero_emenda: string };
type StateRecord = { year: number; amendment_number: string; payload: unknown };
type StateDestination = { year: number; amendment_number: string; destination: string; creditor_municipality_ibge: string | null };

export function buildMunicipalityMap(allocations: Allocation[], plans: Plan[], expenses: Expense[], listings: StateListing[], destinations: StateDestination[], agreements: StateRecord[]) {
  const rows = new Map(pbMunicipalities.map(([code, name]) => [code, { codigoIbge: code, municipio: name,
    federal: { comRecursos: false, emendas: new Set<string>(), empenhado: 0, pago: 0, planos: 0, valorPlanos: 0, despesaEmpenhado: 0, despesaPago: 0 },
    estadual: new Map<string, { ano: number; numero: string; fontes: Set<string> }>(),
  }]));
  let nonMunicipalAllocations = 0, nonMunicipalState = 0;
  for (const record of allocations) {
    const code = names.get(municipalityKey(record.localidade_gasto));
    const row = code ? rows.get(code) : undefined;
    if (!row) { nonMunicipalAllocations++; continue; }
    row.federal.emendas.add(record.codigo_emenda);
    row.federal.empenhado += Number(record.valor_empenhado ?? 0);
    row.federal.pago += Number(record.valor_pago ?? 0);
  }
  for (const plan of plans) {
    const beneficiary = municipalityKey(plan.nome_beneficiario ?? "").replace(/^MUNICIPIO D[EOA] /, "");
    const code = names.get(beneficiary);
    const row = code ? rows.get(code) : undefined;
    if (!row) continue;
    row.federal.planos++;
    row.federal.valorPlanos += Number(plan.valor_custeio ?? 0) + Number(plan.valor_investimento ?? 0);
  }
  for (const expense of expenses) {
    const code = names.get(municipalityKey(expense.municipio ?? ""));
    const row = code ? rows.get(code) : undefined;
    if (!row) continue;
    row.federal.despesaEmpenhado += Number(expense.valor_empenhado ?? 0);
    row.federal.despesaPago += Number(expense.valor_pago ?? 0);
  }
  const normalized = (number: string) => String(Number(number.split("/")[0]));
  const known = new Map(listings.map(listing => [`${listing.ano}:${normalized(listing.numero_emenda)}`, listing]));
  const linkedState = new Set<string>();
  const linkState = (year: number, amendment: string, code: string | null | undefined, basis: string) => {
    const listing = known.get(`${year}:${amendment}`);
    const row = listing && code ? rows.get(code) : undefined;
    if (!listing || !row) return;
    const key = `${listing.ano}:${listing.numero_emenda}`;
    linkedState.add(key);
    const item = row.estadual.get(key) ?? { ano: listing.ano, numero: listing.numero_emenda, fontes: new Set<string>() };
    item.fontes.add(basis);
    row.estadual.set(key, item);
  };
  // Only a municipal transfer names the beneficiary city; a private entity's
  // address is its seat, not where the money is applied.
  for (const record of destinations)
    if (record.destination === "municipal_transfer")
      linkState(record.year, record.amendment_number, record.creditor_municipality_ibge, "Transferência ao município na nota de empenho");
  // Same rule for agreements: the convenente's municipality is the beneficiary
  // only when the convenente is the municipality itself, never an NGO's seat.
  for (const record of agreements) {
    const payload = (record.payload ?? {}) as Record<string, unknown>;
    if (!/^(PREF|MUNIC[IÍ]PIO D|FUNDO MUNICIPAL)/i.test(String(payload.nome ?? "").trim())) continue;
    linkState(record.year, record.amendment_number, names.get(municipalityKey(String(payload.municipio ?? ""))), "Município convenente no instrumento");
  }
  for (const listing of listings) if (!linkedState.has(`${listing.ano}:${listing.numero_emenda}`)) nonMunicipalState++;
  return {
    items: [...rows.values()].map(row => ({ codigoIbge: row.codigoIbge, municipio: officialNames.get(row.codigoIbge)!,
      federal: { ...row.federal, comRecursos: [row.federal.empenhado, row.federal.pago, row.federal.valorPlanos, row.federal.despesaEmpenhado, row.federal.despesaPago].some(positive), emendas: row.federal.emendas.size },
      estadual: { emendas: [...row.estadual.values()].map(item => ({ ...item, fontes: [...item.fontes] })), quantidade: row.estadual.size },
    })),
    semMunicipio: { alocacoesFederais: nonMunicipalAllocations, emendasEstaduais: nonMunicipalState },
  };
}
