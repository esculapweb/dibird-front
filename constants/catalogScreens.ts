/**
 * Экраны справочника — те, что зарегистрированы в обоих стеках сразу
 * (`navigation/catalogScreens.tsx`, тип `CatalogParamList`).
 *
 * Отдельный модуль без импортов: `navigation/catalogScreens.tsx` тянет за
 * собой все семь экранов со всей их периферией (expo-audio, maplibre и
 * прочее), а потребителям списка — `services/authReturn.ts` — нужны только
 * имена. За тем, что список не разъехался с регистрациями, следит
 * `navigation/__tests__/catalogScreens.test.tsx`.
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
