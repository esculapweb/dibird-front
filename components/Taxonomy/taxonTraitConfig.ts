import { TaxonTraitFilters, TraitFilterOption } from "../../types";

// Shared trait-filter config, used both by the filter sheet (to build the
// controls) and by the chips row (to label what is active). Kept in one place
// so a bucket/group defined once drives both.

export type Bucket = Record<string, number | null | string> & {
  labelKey: string;
};

// Typing grams on a phone is nobody's idea of a filter, so the numeric
// traits are offered as buckets that map onto the API's min/max.
export const MASS_BUCKETS: Bucket[] = [
  { labelKey: "mass_tiny", mass_min: null, mass_max: 20 },
  { labelKey: "mass_small", mass_min: 20, mass_max: 100 },
  { labelKey: "mass_medium", mass_min: 100, mass_max: 1000 },
  { labelKey: "mass_large", mass_min: 1000, mass_max: null },
];

export const CLUTCH_BUCKETS: Bucket[] = [
  { labelKey: "clutch_small", clutch_min: null, clutch_max: 2 },
  { labelKey: "clutch_medium", clutch_min: 3, clutch_max: 5 },
  { labelKey: "clutch_large", clutch_min: 6, clutch_max: null },
];

export type VocabularyKey =
  | "habitat"
  | "migration"
  | "trophic_level"
  | "trophic_niche";

export type TaxonTraitGroup =
  | { id: string; labelKey: string; buckets: Bucket[] }
  | { id: VocabularyKey; labelKey: string; vocabulary: VocabularyKey };

// One row per group, all collapsed to start with: 36 chips at once was a
// wall of text nobody could get past to the Apply button.
export const GROUPS: TaxonTraitGroup[] = [
  { id: "mass", labelKey: "mass", buckets: MASS_BUCKETS },
  { id: "clutch", labelKey: "clutch", buckets: CLUTCH_BUCKETS },
  { id: "habitat", labelKey: "habitat", vocabulary: "habitat" },
  { id: "migration", labelKey: "migration", vocabulary: "migration" },
  { id: "trophic_level", labelKey: "trophic_level", vocabulary: "trophic_level" },
  { id: "trophic_niche", labelKey: "trophic_niche", vocabulary: "trophic_niche" },
];

export const hasTraitFilters = (filters: TaxonTraitFilters) =>
  Object.values(filters).some((value) =>
    Array.isArray(value) ? value.length > 0 : value != null,
  );

// A bucket is "on" when every bound it sets is the one currently applied.
// An open-ended bucket ("over 1 kg") leaves its other bound unset, so an
// absent value and a null bound have to compare equal.
export const matchesBucket = (filters: TaxonTraitFilters, bucket: Bucket) =>
  Object.entries(bucket).every(
    ([key, bound]) =>
      key === "labelKey" ||
      (filters[key as "mass_min"] ?? null) === (bound ?? null),
  );

// The visible labels for the values selected in a vocabulary group, in the
// API's order — used by the sheet's folded-row summary and the chips row.
export const vocabLabels = (
  options: TraitFilterOption[] | undefined,
  selected: string[],
) =>
  (options ?? [])
    .filter((option) => selected.includes(option.value))
    .map((option) => option.label);

// GROUPS' and the buckets' labelKey, resolved at runtime by the filter sheet
// and the chips row — listed so `npm run i18n:extract` keeps them.
// t("mass")
// t("mass_tiny")
// t("mass_small")
// t("mass_medium")
// t("mass_large")
// t("clutch")
// t("clutch_small")
// t("clutch_medium")
// t("clutch_large")
// t("habitat")
// t("migration")
// t("trophic_level")
// t("trophic_niche")
