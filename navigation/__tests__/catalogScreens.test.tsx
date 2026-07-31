// The catalogue screens drag in expo-audio, maplibre and other native
// periphery — only their names matter here, so all seven are stubbed out.
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

// No Screen is rendered — only the props are read out of the fragment.
const Stack = { Screen: () => null } as unknown as ReturnType<
  typeof createNativeStackNavigator<CatalogParamList>
>;

const registeredNames = () => {
  const fragment = catalogScreens(Stack, ((key: string) => key) as TFunction);
  return Children.toArray(fragment.props.children)
    .filter(isValidElement)
    .map((child) => (child as ReactElement<{ name: string }>).props.name);
};

// CATALOG_SCREEN_NAMES lives separately from the registrations (otherwise
// importing it would drag in all the screens), so this check is the only thing
// keeping the two lists together. Once they drift apart, a guest will not be
// returned after a login to a screen missing from the list and will silently end
// up on MainScreen.
it("CATALOG_SCREEN_NAMES matches the screens actually registered", () => {
  expect(registeredNames().sort()).toEqual([...CATALOG_SCREEN_NAMES].sort());
});
