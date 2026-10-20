import { pbMunicipalities } from "./municipality-catalog.js";

export const municipalityKey = (name: string) => name.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim().replace(/\s+/g, " ").replace(/ - PB$/, "");
const codesByName = new Map(pbMunicipalities.map(([code, name]) => [municipalityKey(name), code]));
const namesByCode = new Map(pbMunicipalities);

/** IBGE code from an official name (any accents/case) or from the code itself. */
export const findMunicipalityCode = (nameOrCode: string) =>
  namesByCode.has(nameOrCode.trim()) ? nameOrCode.trim() : codesByName.get(municipalityKey(nameOrCode));
export const municipalityName = (code: string | null | undefined) => (code ? namesByCode.get(code) : undefined);
