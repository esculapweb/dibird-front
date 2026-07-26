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
 * Регистрация экранов справочника. Один список на два стека: `AppStack` и
 * гостевой `AuthStack` — см. `CatalogParamList`. Дублировать эти семь
 * регистраций нельзя: разъехавшийся `options` означал бы, что у гостя и у
 * залогиненного один и тот же экран называется по-разному.
 *
 * Возвращает фрагмент, а не компонент: `Stack.Navigator` принимает в children
 * только собственные `Screen`/`Group`, обёртка сломала бы навигатор.
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
