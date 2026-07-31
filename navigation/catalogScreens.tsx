import type { TFunction } from "i18next";
import type { createNativeStackNavigator } from "@react-navigation/native-stack";

import SpeciesDetailScreen from "../screens/SpeciesDetailScreen";
import TaxonomyScreen from "../screens/TaxonomyScreen";
import TaxonGroupDetailScreen from "../screens/TaxonGroupDetailScreen";
import SpeciesCompareScreen from "../screens/SpeciesCompareScreen";
import TerritoryListScreen from "../screens/TerritoryListScreen";
import TerritoryDetailScreen from "../screens/TerritoryDetailScreen";
import TerritoryCompareScreen from "../screens/TerritoryCompareScreen";
import type { CatalogParamList } from "../types";

/**
 * Registration of the catalogue screens. One list for two stacks: `AppStack` and
 * the guest `AuthStack` — see `CatalogParamList`. Duplicating these seven
 * registrations is not an option: `options` drifting apart would mean the same
 * screen is named differently for a guest and for a signed-in user.
 *
 * Returns a fragment rather than a component: `Stack.Navigator` accepts only its
 * own `Screen`/`Group` as children, a wrapper would break the navigator.
 */
export const catalogScreens = <P extends CatalogParamList>(
  Stack: ReturnType<typeof createNativeStackNavigator<P>>,
  t: TFunction,
) => (
  <>
    <Stack.Screen
      name="SpeciesDetail"
      component={SpeciesDetailScreen}
      options={{ title: t("species") }}
    />

    <Stack.Screen
      name="Taxonomy"
      component={TaxonomyScreen}
      options={{ title: t("species") }}
    />

    <Stack.Screen
      name="TaxonGroupDetail"
      component={TaxonGroupDetailScreen}
      options={{ title: t("species") }}
    />

    <Stack.Screen
      name="SpeciesCompare"
      component={SpeciesCompareScreen}
      options={{ title: t("compare_species") }}
    />

    <Stack.Screen
      name="TerritoryList"
      component={TerritoryListScreen}
      options={{ title: t("countries") }}
    />

    <Stack.Screen
      name="TerritoryDetail"
      component={TerritoryDetailScreen}
      options={{ title: t("countries") }}
    />

    <Stack.Screen
      name="TerritoryCompare"
      component={TerritoryCompareScreen}
      options={{ title: t("compare_territories") }}
    />
  </>
);
