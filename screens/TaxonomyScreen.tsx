import { useLayoutEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useNavigation, useRoute } from "@react-navigation/native";

import Layout from "../components/ui/Layout";
import IconsHeader from "../components/ui/IconsHeader";
import TaxonChildrenList from "../components/Taxonomy/TaxonChildrenList";
import TaxonFilterSheet, {
  hasTraitFilters,
} from "../components/Taxonomy/TaxonFilterSheet";
import { BottomSheet } from "../services/bottomSheet";
import { callNavigationCallback } from "../util/navigationCallbacks";
import { useTaxonomySort } from "../hooks/useTaxonomySort";
import { useTheme, ThemeColors } from "../store/theme-context";
import {
  AppStackNavigationProp,
  AppStackRouteProp,
  TaxonTraitFilters,
} from "../types";

const RANK_TITLE_KEY: Record<number, string> = {
  2: "orders",
  3: "families",
  4: "genera",
  5: "species",
};

const RANK_EMPTY_KEY: Record<number, string> = {
  2: "no_orders_found",
  3: "no_families_found",
  4: "no_genera_found",
  5: "no_species_found",
};

const TaxonomyScreen = () => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const navigation = useNavigation<AppStackNavigationProp>();
  const route = useRoute<AppStackRouteProp<"Taxonomy">>();
  const { rank, parentSegment, parentRank, extinct, title, focusSearch, pickerKey } =
    route.params;
  // Two roots now: the flat species list (where the catalogue opens) and
  // the order tree behind it. Each links to the other so neither is a dead
  // end, and neither shows the links when it is nested under a parent.
  const isOrderRoot = rank === 2 && !parentSegment && !extinct;
  const isSpeciesRoot = rank === 5 && !parentSegment && !extinct && !pickerKey;
  const { sort, openSortSheet } = useTaxonomySort();
  const [traits, setTraits] = useState<TaxonTraitFilters>({});

  // Traits are only recorded for species, so the filter button would come
  // back empty-handed on any other rank.
  const canFilter = rank === 5;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: title ?? t(RANK_TITLE_KEY[rank]),
      headerRight: () => (
        <IconsHeader
          onSortPress={openSortSheet}
          hasActiveFilters={hasTraitFilters(traits)}
          onFilterPress={
            canFilter
              ? () =>
                  // No `title` on purpose: the shared title block is its own
                  // BottomSheetView, and with dynamic sizing a second measured
                  // node fights the sheet's height (see TaxonFilterSheet).
                  BottomSheet.showContent({
                    renderContent: (dismiss: () => void) => (
                      <TaxonFilterSheet
                        value={traits}
                        onApply={setTraits}
                        dismiss={dismiss}
                      />
                    ),
                  })
              : undefined
          }
        />
      ),
    });
  }, [navigation, title, rank, t, openSortSheet, traits, canFilter]);

  const shortcut = (
    label: string,
    icon:
      | "search-outline"
      | "skull-outline"
      | "git-compare-outline"
      | "git-branch-outline",
    onPress: () => void,
  ) => (
    <Pressable style={styles.shortcut} onPress={onPress}>
      <Ionicons name={icon} size={18} color={Colors.main100} />
      <Text style={styles.shortcutText}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={Colors.main100} />
    </Pressable>
  );

  return (
    <Layout>
      <TaxonChildrenList
        rank={rank}
        parent={
          parentSegment && parentRank
            ? { segment: parentSegment, rank: parentRank }
            : null
        }
        extinct={extinct}
        sort={sort}
        traits={traits}
        onClearTraits={() => setTraits({})}
        onPick={
          pickerKey
            ? (item) => {
                callNavigationCallback(pickerKey, item);
                navigation.goBack();
              }
            : undefined
        }
        searchPlaceholder={rank === 5 ? t("search_species_hint") : undefined}
        autoFocusSearch={focusSearch}
        errorTitle={t("taxonomy_unavailable")}
        emptyMessage={t(RANK_EMPTY_KEY[rank])}
        listHeader={
          isOrderRoot || isSpeciesRoot ? (
            <View style={styles.shortcuts}>
              {isSpeciesRoot &&
                shortcut(t("browse_by_groups"), "git-branch-outline", () =>
                  navigation.push("Taxonomy", { rank: 2 }),
                )}
              {isOrderRoot &&
                shortcut(t("all_species"), "search-outline", () =>
                  navigation.push("Taxonomy", {
                    rank: 5,
                    title: t("species_catalog"),
                  }),
                )}
              {shortcut(t("extinct_species"), "skull-outline", () =>
                navigation.push("Taxonomy", {
                  rank: 5,
                  extinct: true,
                  title: t("extinct_species"),
                }),
              )}
              {shortcut(t("compare_species"), "git-compare-outline", () =>
                navigation.navigate("SpeciesCompare", undefined),
              )}
            </View>
          ) : undefined
        }
      />
    </Layout>
  );
};

export default TaxonomyScreen;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    shortcuts: { gap: 4, marginBottom: 8 },
    shortcut: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: Colors.main300,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    shortcutText: {
      flex: 1,
      fontSize: 14,
      fontWeight: "600",
      color: Colors.main100,
    },
  });
