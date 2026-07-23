import { TaxonTraitFilters } from "../types";
import { langBaseUrl } from "./helpers";

// One place for the catalogue share link's encode/decode so the URL the app
// builds and the URL the deep-link parser reads can never drift apart. Param
// names match the /api/taxon/ query (see traitParams in util/fetches.ts), so
// the same link also filters the website where it can.

const NUMBER_KEYS = [
  "territory",
  "mass_min",
  "mass_max",
  "clutch_min",
  "clutch_max",
] as const;

const LIST_KEYS = [
  "habitat",
  "migration",
  "trophic_level",
  "trophic_niche",
] as const;

export const taxonFiltersToParams = (
  traits: TaxonTraitFilters,
): Record<string, string> => {
  const params: Record<string, string> = {};

  for (const key of NUMBER_KEYS) {
    const value = traits[key];
    if (value != null) params[key] = String(value);
  }
  for (const key of LIST_KEYS) {
    const value = traits[key];
    if (value && value.length > 0) params[key] = value.join(",");
  }
  return params;
};

export const paramsToTaxonFilters = (
  params: URLSearchParams,
): TaxonTraitFilters => {
  const traits: TaxonTraitFilters = {};

  for (const key of NUMBER_KEYS) {
    const raw = params.get(key);
    if (raw == null || raw === "") continue;
    const num = Number(raw);
    if (!Number.isNaN(num)) traits[key] = num;
  }
  for (const key of LIST_KEYS) {
    const raw = params.get(key);
    if (!raw) continue;
    const values = raw.split(",").filter(Boolean);
    if (values.length > 0) traits[key] = values;
  }
  return traits;
};

// The shareable taxonomy list pages, keyed by their web path segment. Only the
// flat roots map to a web URL (all species, extinct, orders); nested lists
// don't. `o` carries the sort (site and app both read it), the filters (species
// only) carry the rest.
export type TaxonListPath = "species" | "extinct" | "order";

// The web path for a taxonomy list screen, or null if it isn't a shareable
// root (e.g. families/genera, which are only reached nested under a parent).
export const taxonListSharePath = (
  rank: number,
  extinct?: boolean,
): TaxonListPath | null => {
  if (rank === 2) return "order";
  if (rank === 5) return extinct ? "extinct" : "species";
  return null;
};

// Website URL, locale-aware; opens the app's list when the app is installed
// (see linking.ts), otherwise the site's page.
export const buildTaxonCatalogUrl = (
  path: TaxonListPath,
  traits: TaxonTraitFilters,
  sort?: string | null,
): string => {
  const base = `${langBaseUrl()}/${path}/`;
  const params = taxonFiltersToParams(traits);
  if (sort) params.o = sort;
  const query = new URLSearchParams(params).toString();
  return query ? `${base}?${query}` : base;
};
