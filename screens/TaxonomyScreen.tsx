import { useLayoutEffect, useState } from "react";
import { Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { track } from "../services/analytics";
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
import {
  buildTaxonCatalogUrl,
  taxonListSharePath,
} from "../util/taxonShareLink";
import { useTheme, ThemeColors } from "../store/theme-context";
import {
  CatalogNavigationProp,
  CatalogRouteProp,
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
  const navigation = useNavigation<CatalogNavigationProp>();
  const route = useRoute<CatalogRouteProp<"Taxonomy">>();
  const {
    rank,
    parentSegment,
    parentRank,
    extinct,
    title,
    focusSearch,
    pickerKey,
    initialTraits,
    initialSort,
    initialSearch,
  } = route.params;
  // Two roots now: the flat species list (where the catalogue opens) and
  // the order tree behind it. Each links to the other so neither is a dead
  // end, and neither shows the links when it is nested under a parent.
  const isOrderRoot = rank === 2 && !parentSegment && !extinct;
  const isSpeciesRoot = rank === 5 && !parentSegment && !extinct && !pickerKey;
  // A shared link can pin the sort; the hook drops the pin once the user picks
  // their own order, so the sort control keeps working.
  const { sort, openSortSheet } = useTaxonomySort(initialSort);
  const [traits, setTraits] = useState<TaxonTraitFilters>(initialTraits ?? {});
  // Owned here (not inside TaxonChildrenList) so the share button can encode
  // the current name search into the link, like traits and sort.
  const [search, setSearch] = useState(initialSearch ?? "");

  // Traits are only recorded for species, so the filter button would come
  // back empty-handed on any other rank.
  const canFilter = rank === 5;

  // Shareable list roots — all species, extinct, orders — each at its own web
  // path. Nested lists (families/genera under a parent) and pickers can't be
  // shared, so this is null there.
  const sharePath =
    !pickerKey && !parentSegment ? taxonListSharePath(rank, extinct) : null;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: title ?? (extinct ? t("extinct_species") : t(RANK_TITLE_KEY[rank])),
      headerRight: () => (
        <IconsHeader
          onSortPress={openSortSheet}
          hasActiveFilters={hasTraitFilters(traits)}
          onSharePress={
            sharePath
              ? async () => {
                  const url = buildTaxonCatalogUrl(
                    sharePath,
                    traits,
                    sort,
                    search,
                  );
                  track("share_tapped", { type: "taxon_list" });
                  await Share.share(
                    Platform.OS === "ios" ? { url } : { message: url },
                  );
                }
              : undefined
          }
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
  }, [
    navigation,
    title,
    rank,
    extinct,
    t,
    openSortSheet,
    traits,
    canFilter,
    sharePath,
    sort,
    search,
  ]);

  // Two per row: as full-width rows the four of them ate a third of the
  // screen before the first bird.
  const shortcut = (
    label: string,
    icon:
      | "search-outline"
      | "skull-outline"
      | "git-compare-outline"
      | "git-branch-outline"
      | "globe-outline",
    onPress: () => void,
  ) => (
    <Pressable key={label} style={styles.shortcut} onPress={onPress}>
      <Ionicons name={icon} size={18} color={Colors.main100} />
      <Text style={styles.shortcutText} numberOfLines={2}>
        {label}
      </Text>
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
        onChangeTraits={setTraits}
        search={search}
        onChangeSearch={setSearch}
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
              {/* The other way into the catalogue: by place rather than by
                  taxon — a country's checklist. */}
              {shortcut(t("birds_by_country"), "globe-outline", () =>
                navigation.navigate("TerritoryList", undefined),
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
    shortcuts: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 8,
    },
    shortcut: {
      // Two to a row, whatever the screen width: half of it, less the gap.
      flexBasis: "48%",
      flexGrow: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: Colors.main300,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    shortcutText: {
      flex: 1,
      fontSize: 13,
      fontWeight: "600",
      color: Colors.main100,
    },
  });

// RANK_TITLE_KEY and RANK_EMPTY_KEY, resolved by rank at runtime — listed so
// `npm run i18n:extract` keeps them.
// t("orders")
// t("families")
// t("genera")
// t("species")
// t("no_orders_found")
// t("no_families_found")
// t("no_genera_found")
// t("no_species_found")
