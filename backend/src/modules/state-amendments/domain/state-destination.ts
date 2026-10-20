import { municipalityName } from "../../../shared/territory/municipalities.js";
import type { Amount } from "./state-amendment.js";

/** Amendment x creditor x modality with positive net commitment (etl.state.destinations). */
export type StateDestination = {
  year: number;
  amendment_number: string;
  creditor_document: string | null;
  creditor_name: string | null;
  application_modality: string | null;
  destination: string;
  creditor_municipality: string | null;
  creditor_municipality_ibge: string | null;
  committed_value: Amount;
  note_count: number;
};

export const MUNICIPAL_TRANSFER = "municipal_transfer";
export const destinationLabels: Record<string, string> = {
  municipal_transfer: "Transferência ao município",
  private_nonprofit: "Entidade privada sem fins lucrativos",
  private_for_profit: "Entidade privada com fins lucrativos",
  direct_execution: "Aplicação direta pelo Estado",
  other: "Outra modalidade",
};

/** Number as stored by the documentary ETL: "0799/2024" -> "799"; other years are rejected. */
export function normalizedAmendmentNumber(year: number, number: string) {
  const match = /^\s*(\d+)(?:\s*\/\s*(\d{4}))?\s*$/.exec(number);
  return match && (!match[2] || Number(match[2]) === year) ? String(Number(match[1])) : null;
}
export const destinationKey = (year: number, number: string) => `${year}:${normalizedAmendmentNumber(year, number) ?? "invalid"}`;

/** Only a municipal transfer names the beneficiary city; an entity's address is its seat. */
export function beneficiaryMunicipalities(destinations: StateDestination[]) {
  return [...new Set(destinations
    .filter(row => row.destination === MUNICIPAL_TRANSFER)
    .flatMap(row => municipalityName(row.creditor_municipality_ibge) ?? []))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function describeDestinations(destinations: StateDestination[]) {
  return destinations
    .map(row => {
      const municipal = row.destination === MUNICIPAL_TRANSFER;
      const seat = municipalityName(row.creditor_municipality_ibge) ?? row.creditor_municipality;
      return {
        credor: row.creditor_name,
        documentoCredor: row.creditor_document,
        modalidadeAplicacao: row.application_modality,
        destino: row.destination,
        destinoRotulo: destinationLabels[row.destination] ?? destinationLabels.other,
        municipioCredor: seat,
        municipioBeneficiado: municipal ? municipalityName(row.creditor_municipality_ibge) ?? null : null,
        codigoIbge: municipal ? row.creditor_municipality_ibge : null,
        valorEmpenhadoLiquido: Number(row.committed_value ?? 0),
        notas: row.note_count,
      };
    })
    .sort((a, b) => b.valorEmpenhadoLiquido - a.valorEmpenhadoLiquido);
}

/** Totals by destination; an amendment split across destinations counts in each. */
export function summarizeDestinations(destinations: StateDestination[]) {
  const groups = new Map<string, { amendments: Set<string>; value: number }>();
  for (const row of destinations) {
    const group = groups.get(row.destination) ?? { amendments: new Set<string>(), value: 0 };
    group.amendments.add(`${row.year}:${row.amendment_number}`);
    group.value += Number(row.committed_value ?? 0);
    groups.set(row.destination, group);
  }
  const located = new Set(destinations
    .filter(row => row.destination === MUNICIPAL_TRANSFER && row.creditor_municipality_ibge)
    .map(row => `${row.year}:${row.amendment_number}`));
  return {
    emendasComMunicipioBeneficiado: located.size,
    porDestino: [...groups].map(([destination, group]) => ({
      destino: destination,
      rotulo: destinationLabels[destination] ?? destinationLabels.other,
      emendas: group.amendments.size,
      valorEmpenhadoLiquido: group.value,
    })).sort((a, b) => b.valorEmpenhadoLiquido - a.valorEmpenhadoLiquido),
  };
}
