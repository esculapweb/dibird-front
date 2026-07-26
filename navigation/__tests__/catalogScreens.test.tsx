// Экраны справочника тянут за собой expo-audio, maplibre и прочую нативную
// периферию — здесь важны только их имена, поэтому все семь заглушены.
jest.mock("../../screens/SpeciesDetailScreen", () => () => null);
jest.mock("../../screens/TaxonomyScreen", () => () => null);
jest.mock("../../screens/TaxonGroupDetailScreen", () => () => null);
jest.mock("../../screens/SpeciesCompareScreen", () => () => null);
jest.mock("../../screens/TerritoryListScreen", () => () => null);
jest.mock("../../screens/TerritoryDetailScreen", () => () => null);
jest.mock("../../screens/TerritoryCompareScreen", () => () => null);

import { Children, isValidElement, type ReactElement } from "react";
import type { TFunction } from "i18next";
import type { createNativeStackNavigator } from "@react-navigation/native-stack";

import { catalogScreens } from "../catalogScreens";
import { CATALOG_SCREEN_NAMES } from "../../constants/catalogScreens";
import type { CatalogParamList } from "../../types";

// Ни один Screen не рендерится — из фрагмента читаются только пропсы.
const Stack = { Screen: () => null } as unknown as ReturnType<
  typeof createNativeStackNavigator<CatalogParamList>
>;

const registeredNames = () => {
  const fragment = catalogScreens(Stack, ((key: string) => key) as TFunction);
  return Children.toArray(fragment.props.children)
    .filter(isValidElement)
    .map((child) => (child as ReactElement<{ name: string }>).props.name);
};

// CATALOG_SCREEN_NAMES живёт отдельно от регистраций (иначе его импорт тянул
// бы за собой все экраны), поэтому единственное, что держит два списка
// вместе, — эта проверка. Разъехались они — гость после логина не вернётся на
// экран, которого в списке нет, и молча окажется на MainScreen.
it("CATALOG_SCREEN_NAMES matches the screens actually registered", () => {
  expect(registeredNames().sort()).toEqual([...CATALOG_SCREEN_NAMES].sort());
});
