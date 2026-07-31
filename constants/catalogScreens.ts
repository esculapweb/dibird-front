/**
 * The catalogue screens — the ones registered in both stacks at once
 * (`navigation/catalogScreens.tsx`, type `CatalogParamList`).
 *
 * A separate module with no imports: `navigation/catalogScreens.tsx` drags in
 * all seven screens with all their periphery (expo-audio, maplibre and the
 * rest), while the consumers of the list — `services/authReturn.ts` — only need
 * the names. That the list has not drifted apart from the registrations is
 * watched by `navigation/__tests__/catalogScreens.test.tsx`.
 */
export const CATALOG_SCREEN_NAMES = [
  "SpeciesDetail",
  "Taxonomy",
  "TaxonGroupDetail",
  "SpeciesCompare",
  "TerritoryList",
  "TerritoryDetail",
  "TerritoryCompare",
] as const;
