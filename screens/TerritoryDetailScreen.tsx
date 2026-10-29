import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import RenderHtml from "react-native-render-html";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { track } from "../services/analytics";

import Layout from "../components/ui/Layout";
import Section from "../components/ui/Section";
import Tabs from "../components/ui/Tabs";
import IconsHeader from "../components/ui/IconsHeader";
import { overflowButton } from "../components/ui/overflowMenu";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import EmptyState from "../components/Empty/EmptyState";
import TerritoryChecklist from "../components/Territory/TerritoryChecklist";
import TaxonChildrenList from "../components/Taxonomy/TaxonChildrenList";
import SpeciesViewSwitch from "../components/Taxonomy/SpeciesViewSwitch";
import TaxonFilterSheet, {
  hasTraitFilters,
} from "../components/Taxonomy/TaxonFilterSheet";
import { BottomSheet } from "../services/bottomSheet";
import { useTaxonomySort } from "../hooks/useTaxonomySort";
import { useSpeciesViewMode } from "../hooks/useSpeciesViewMode";
import { useContentWidth } from "../hooks/useContentWidth";
import { fetchTerritoryDetail } from "../util/fetches";
import { buildTerritoryDetailUrl } from "../util/taxonShareLink";
import { isoToFlagEmoji } from "../util/helpers";
import { htmlBaseStyle, htmlTagsStyles } from "../util/htmlStyles";
import { StaleTime } from "../constants/staleTime";
import { useLanguage } from "../store/language-context";
import { useTheme, ThemeColors } from "../store/theme-context";
import {
  CatalogNavigationProp,
  CatalogRouteProp,
  TaxonTraitFilters,
  TerritoryDetail,
  territoryTab,
  territoryView,
} from "../types";

// Two ways to read a country's birds: the taxonomic tree (order → family →
// species, the app's own checklist, fixed order) and the plain species list
// (paginated, sortable, the same one the catalogue uses everywhere else) —
// `territoryView` in types.ts.
//
// The country's own page (flag, counts, description, prev/next) and its birds
// are two separate reads, split by the bottom tabs (`territoryTab`) — the
// species list would otherwise start below a screenful of description. The
// birds are what the page is for, so they open first.

const TerritoryDetailScreen = () => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const width = useContentWidth();
  const { language } = useLanguage();
  const styles = stylesFn(Colors);
  const navigation = useNavigation<CatalogNavigationProp>();
  const route = useRoute<CatalogRouteProp<"TerritoryDetail">>();
  const { segment, initialTab, initialView, initialSort, initialTraits } =
    route.params;
  const [tab, setTab] = useState<territoryTab>(initialTab ?? "species");
  const [view, setView] = useState<territoryView>(initialView ?? "tree");
  // The photo grid is a third way to lay the birds out, but not a third
  // `territoryView`: it shows the flat list's data, and the preference is
  // shared with every other species list (useSpeciesViewMode). A shared link
  // names its own layout, so the stored gallery preference waits until the
  // reader touches the switch.
  const speciesView = useSpeciesViewMode();
  const [linkPinned, setLinkPinned] = useState(initialView != null);
  const isPhotos = speciesView.isPhotos && !linkPinned;
  // The grid is the flat list drawn as tiles: same endpoint, sort and filters.
  const isFlatData = view === "flat" || isPhotos;
  // The country is not one of these — it is the page (see fixedTraits below),
  // so the sheet opens without its country dropdown.
  const [filters, setFilters] = useState<TaxonTraitFilters>(
    initialTraits ?? {},
  );
  // The flat list is an ordinary taxonomy listing, so it follows the
  // catalogue-wide order preference. A shared link pins its own order until
  // the reader picks one (useScreenSort drops the pin then). The tree has no
  // sort of its own — it is taxonomic by definition (same as the checklist
  // screen, allowSort: false).
  const { sort, openSortSheet } = useTaxonomySort(initialSort);

  const detailQuery = useQuery<TerritoryDetail>({
    queryKey: ["TerritoryDetail", segment, language],
    queryFn: () => fetchTerritoryDetail(segment),
    staleTime: StaleTime.ONE_DAY,
  });

  const data = detailQuery.data;
  // Both species views are keyed by our own Territory.pk, which only the
  // detail response carries — the screen is reached by segment.
  const territoryId = data?.territory_id;

  // The header button and the chips row open the same sheet; a chip passes
  // the group it stands for, so the sheet opens on that filter.
  const openTraitSheet = (focusGroup?: string) =>
    BottomSheet.showContent({
      renderContent: (dismiss: () => void) => (
        <TaxonFilterSheet
          value={filters}
          onApply={setFilters}
          dismiss={dismiss}
          showCountry={false}
          focusGroup={focusGroup}
        />
      ),
    });

  useLayoutEffect(() => {
    navigation.setOptions({
      title: data?.name ?? t("countries"),
      headerRight: () => (
        <IconsHeader

          onSortPress={
            tab === "species" && isFlatData ? openSortSheet : undefined
          }
          hasActiveFilters={hasTraitFilters(filters)}
          onFilterPress={
            // The tree comes from the checklist endpoint, which takes no
            // trait filters — only the flat list can be narrowed.
            tab === "species" && isFlatData
              ? () => openTraitSheet()
              : undefined
          }
          headerRightEnd={[
            overflowButton([
              {
                label: t("compare_territories"),
                icon: "git-compare-outline",
                testID: "compare-territory-button",
                onPress: () =>
                  navigation.navigate("TerritoryCompare", {
                    segment1: segment,
                  }),
              },
              {
                label: t("share"),
                icon: "share-social-outline",
                onPress: () => {
                  // Reopens on the same tab and layout, with the flat list's
                  // sort and filters — see buildTerritoryDetailUrl /
                  // linking.ts.
                  // The website has no photo layout of its own, so the grid
                  // shares as the flat list it is drawn from.
                  const url = buildTerritoryDetailUrl(segment, {
                    tab,
                    view: isFlatData ? "flat" : "tree",
                    sort,
                    traits: filters,
                  });
                  track("share_tapped", { type: "territory" });
                  void Share.share(
                    Platform.OS === "ios" ? { url } : { message: url },
                  );
                },
              },
            ]),
          ]}
        />
      ),
    });
  }, [
    navigation,
    data?.name,
    segment,
    t,
    openSortSheet,
    tab,
    isFlatData,
    filters,
    sort,
  ]);

  useEffect(() => {
    if (data?.redirect) {
      navigation.setParams({ segment: data.redirect });
    }
  }, [data?.redirect, navigation]);

  // The second half of the reference — see species_viewed on the species page.
  useEffect(() => {
    track("territory_viewed");
  }, [segment]);

  // Already-localized, number-agreed labels keyed by rank ({"5": "1111
  // species"}) — shown in taxonomic order, deepest last.
  const countLabels = useMemo(
    () =>
      Object.entries(data?.count ?? {})
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([, label]) => label),
    [data?.count],
  );

  if (detailQuery.isError && !data)
    return (
      <ErrorOverlay
        title={t("countries_unavailable")}
        message={detailQuery.error.message}
        onPress={async () => {
          await detailQuery.refetch();
        }}
        logo
      />
    );

  if (detailQuery.isLoading || !data || data.redirect) return <LoadingOverlay />;

  const goToTerritory = (target: string) =>
    navigation.push("TerritoryDetail", { segment: target });

  const flag = isoToFlagEmoji(data.code ?? null);
  const description = data.metadata?.short;

  const pagingFlag = (code?: string | null) => {
    const pagingEmoji = isoToFlagEmoji(code ?? null);

    return (
      <View style={styles.pagingFlag}>
        {pagingEmoji ? (
          <Text style={styles.pagingFlagText}>{pagingEmoji}</Text>
        ) : (
          <Ionicons
            name="globe-outline"
            size={18}
            color={Colors.textSecondary}
          />
        )}
      </View>
    );
  };

  const info = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        {!!flag && <Text style={styles.flag}>{flag}</Text>}
        <View style={styles.titleTexts}>
          <Text style={styles.title}>{data.name}</Text>
          {!!data.region?.name && (
            <Text style={styles.region}>
              {t("region")}: {data.region.name}
            </Text>
          )}
        </View>
      </View>

      {countLabels.length > 0 && (
        <View style={styles.chipsRow}>
          {countLabels.map((label) => (
            <View key={label} style={styles.chip}>
              <Text style={styles.chipText}>{label}</Text>
            </View>
          ))}
        </View>
      )}

      {!!description && (
        <Section title={t("description")} style={styles.description}>
          <RenderHtml
            contentWidth={width - 64}
            source={{ html: description }}
            baseStyle={htmlBaseStyle(Colors)}
            tagsStyles={htmlTagsStyles(Colors)}
          />
        </Section>
      )}

      {(data.paging?.prev || data.paging?.next) && (
        <View style={styles.pagingStrip}>
          {data.paging?.prev ? (
            <Pressable
              style={styles.pagingCard}
              onPress={() => goToTerritory(data.paging!.prev!.segment)}
            >
              <Ionicons
                name="chevron-back"
                size={16}
                color={Colors.textSecondary}
              />
              {pagingFlag(data.paging.prev.code)}
              <Text style={styles.pagingName} numberOfLines={1}>
                {data.paging.prev.name}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.pagingCard} />
          )}

          {data.paging?.next ? (
            <Pressable
              style={styles.pagingCard}
              onPress={() => goToTerritory(data.paging!.next!.segment)}
            >
              <Text
                style={[styles.pagingName, styles.pagingNameEnd]}
                numberOfLines={1}
              >
                {data.paging.next.name}
              </Text>
              {pagingFlag(data.paging.next.code)}
              <Ionicons
                name="chevron-forward"
                size={16}
                color={Colors.textSecondary}
              />
            </Pressable>
          ) : (
            <View style={styles.pagingCard} />
          )}
        </View>
      )}

    </View>
  );

  const viewSwitch = (
    // Not "species" for the flat view — that is the name of the tab this
    // switch already lives in. It picks how the birds are laid out.
    <SpeciesViewSwitch
      options={[
        { value: "tree", label: t("by_groups"), icon: "git-branch-outline" },
        { value: "flat", label: t("as_list"), icon: "list-outline" },
        speciesView.photosOption,
      ]}
      value={isPhotos ? "photos" : view}
      onChange={(next) => {
        setLinkPinned(false);
        if (next === "photos") {
          speciesView.changeLayout("photos");
          return;
        }
        speciesView.changeLayout("list");
        setView(next);
      }}
      testIDPrefix="species-view"
      isPhotos={isPhotos}
      showCaptions={speciesView.showCaptions}
      onToggleCaptions={speciesView.toggleCaptions}
    />
  );

  const speciesContent = !speciesView.ready ? (
    // The tree and the grid load different endpoints — wait for the stored
    // layout instead of fetching the tree only to drop it a frame later.
    <LoadingOverlay />
  ) : (
    // An offline-cached response from before the backend started sending
    // territory_id has the country page but nothing to key the species list
    // with.
    territoryId == null ? (
      <>
        {viewSwitch}
        <EmptyState
          icon="cloud-offline-outline"
          message={t("taxonomy_unavailable")}
          actions={[
            { label: t("try_again"), onPress: () => detailQuery.refetch() },
          ]}
        />
      </>
    ) : !isFlatData ? (
      // The tree is keyed by the Avibase id, the flat list by our Territory.pk:
      // these are two different endpoints (see fetchTerritoryTree and /api/taxon/).
      <TerritoryChecklist
        idAvibase={data.id_avibase}
        listHeader={viewSwitch}
        // A header narrows the flat list to its group, keeping whatever else
        // is filtered: "this order, in this country" with the list's own
        // sort, chips and grid, where the tree can only scroll to it.
        onGroupPress={(group) => {
          setFilters(({ order: _o, family: _f, genus: _g, ...rest }) => ({
            ...rest,
            ...group,
          }));
          setView("flat");
        }}
      />
    ) : (
      <TaxonChildrenList
        speciesSource="territory_species"
        rank={5}
        fixedTraits={{ territory: territoryId }}
        traits={filters}
        onChangeTraits={setFilters}
        onEditTraits={openTraitSheet}
        onClearTraits={() => setFilters({})}
        sort={sort}
        errorTitle={t("taxonomy_unavailable")}
        emptyMessage={t("no_species_found")}
        searchPlaceholder={t("search_species_hint")}
        listHeader={viewSwitch}
        layout={isPhotos ? "photos" : "list"}
        showCaptions={speciesView.showCaptions}
      />
    )
  );

  return (
    <Layout
      bottom={
        <Tabs
          tabOptions={[
            {
              value: "species" as const,
              icon: "list" as const,
              iconInactive: "list-outline" as const,
              labelKey: t("species"),
            },
            {
              value: "info" as const,
              icon: "information-circle" as const,
              iconInactive: "information-circle-outline" as const,
              labelKey: t("description"),
            },
          ]}
          tabsMode={tab}
          setTabsMode={setTab}
        />
      }
    >
      {tab === "info" ? (
        <ScrollView contentContainerStyle={styles.infoContent}>
          {info}
        </ScrollView>
      ) : (
        speciesContent
      )}
    </Layout>
  );
};

export default TerritoryDetailScreen;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    infoContent: { paddingHorizontal: 12, paddingVertical: 8 },
    header: { marginBottom: 4, paddingHorizontal: 4 },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    flag: { fontSize: 34 },
    titleTexts: { flex: 1 },
    title: {
      fontSize: 22,
      fontWeight: "700",
      color: Colors.textMain,
    },
    region: {
      fontSize: 13,
      color: Colors.textSecondary,
      marginTop: 2,
    },
    chipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 8,
      marginBottom: 4,
    },
    chip: {
      backgroundColor: Colors.main300,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    chipText: { fontSize: 12, color: Colors.main100, fontWeight: "600" },
    description: { marginTop: 8, marginHorizontal: -4 },
    pagingStrip: {
      flexDirection: "row",
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
    },
    pagingCard: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 8,
      paddingVertical: 8,
    },
    // The species page's prev/next shows the bird's thumb here; a country's
    // portrait is its flag, in a box of the same shape.
    pagingFlag: {
      width: 32,
      height: 32,
      borderRadius: 6,
      backgroundColor: Colors.primary200,
      justifyContent: "center",
      alignItems: "center",
    },
    pagingFlagText: { fontSize: 20 },
    pagingName: {
      flex: 1,
      fontSize: 12,
      color: Colors.textMain,
    },
    pagingNameEnd: { textAlign: "right" },
  });
