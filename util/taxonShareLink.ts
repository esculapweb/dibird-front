import {
  compareMode,
  SpeciesDetailTab,
  TaxonTraitFilters,
  territoryTab,
  territoryView,
} from "../types";
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
  "status",
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
  search?: string | null,
): string => {
  const base = `${langBaseUrl()}/${path}/`;
  const params = taxonFiltersToParams(traits);
  if (sort) params.o = sort;
  // The catalogue search box filters by name (see fetchAbstract's `name`
  // param); carry it so a shared search reopens with the same query.
  if (search) params.name = search;
  const query = new URLSearchParams(params).toString();
  return query ? `${base}?${query}` : base;
};

// --- Detail pages: which tab / layout the sharer was looking at -------------
//
// The screens below hold their state in tabs and switches rather than in a
// filter sheet, so a plain link drops the reader back on the default view.
// `tab` and `view` carry it across. Both are validated against the values the
// screens actually accept — a hand-edited or stale link must fall back to the
// default rather than put a screen in a state it can't render.

export const TERRITORY_TABS: readonly territoryTab[] = ["species", "info"];
export const TERRITORY_VIEWS: readonly territoryView[] = ["tree", "flat"];
export const COMPARE_TABS: readonly compareMode[] = [
  "all",
  "common",
  "different",
];
export const SPECIES_DETAIL_TABS: readonly SpeciesDetailTab[] = [
  "overview",
  "traits",
  "sounds",
  "countries",
  "names",
];

export const parseEnumParam = <T extends string>(
  raw: string | null,
  allowed: readonly T[],
): T | undefined =>
  raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : undefined;

const buildUrl = (path: string, params: Record<string, string>): string => {
  const base = `${langBaseUrl()}/${path}`;
  const query = new URLSearchParams(params).toString();
  return query ? `${base}?${query}` : base;
};

// The country page. The tree layout takes no sort or filters (it is taxonomic
// by definition), so those only ride along when the flat list is open —
// otherwise the link would promise an order the reader's screen doesn't have.
export const buildTerritoryDetailUrl = (
  segment: string,
  state: {
    tab: territoryTab;
    view: territoryView;
    sort?: string | null;
    traits?: TaxonTraitFilters;
  },
): string => {
  const params: Record<string, string> = {};
  // Defaults stay out of the URL so an untouched page still shares as the
  // short link people expect to see.
  if (state.tab !== "species") params.tab = state.tab;
  if (state.view !== "tree") params.view = state.view;
  if (state.tab === "species" && state.view === "flat") {
    Object.assign(params, taxonFiltersToParams(state.traits ?? {}));
    if (state.sort) params.o = state.sort;
  }
  return buildUrl(`territory/${segment}/`, params);
};

// The two-country comparison. Its tab is which slice of the species list is
// shown (in both / all / in one only) and its search runs locally over the one
// response, so both are pure view state — exactly what a share should carry.
export const buildTerritoryCompareUrl = (
  segment1: string,
  segment2: string,
  state: {
    tab: compareMode;
    sort?: string | null;
    search?: string | null;
  },
): string => {
  const params: Record<string, string> = {};
  if (state.tab !== "all") params.tab = state.tab;
  if (state.sort) params.o = state.sort;
  // Same `name` the catalogue lists use for their search box.
  if (state.search) params.name = state.search;
  return buildUrl(`territory_compare/${segment1}/${segment2}/`, params);
};

// The species page — one long read split into tabs, so a link shared from
// "Sounds" should open on sounds.
export const buildSpeciesDetailUrl = (
  segment: string,
  tab: SpeciesDetailTab,
): string =>
  buildUrl(`species/${segment}/`, tab === "overview" ? {} : { tab });
