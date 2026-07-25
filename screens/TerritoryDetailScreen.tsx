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

import Layout from "../components/ui/Layout";
import Section from "../components/ui/Section";
import Tabs from "../components/ui/Tabs";
import IconsHeader from "../components/ui/IconsHeader";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import EmptyState from "../components/Empty/EmptyState";
import TerritoryChecklist from "../components/Territory/TerritoryChecklist";
import TaxonChildrenList from "../components/Taxonomy/TaxonChildrenList";
import { useTaxonomySort } from "../hooks/useTaxonomySort";
import { useContentWidth } from "../hooks/useContentWidth";
import { fetchTerritoryDetail } from "../util/fetches";
import { buildShareUrl, isoToFlagEmoji } from "../util/helpers";
import { htmlBaseStyle, htmlTagsStyles } from "../util/htmlStyles";
import { StaleTime } from "../constants/staleTime";
import { useLanguage } from "../store/language-context";
import { useTheme, ThemeColors } from "../store/theme-context";
import {
  AppStackNavigationProp,
  AppStackRouteProp,
  TerritoryDetail,
} from "../types";

// Two ways to read a country's birds: the taxonomic tree (order → family →
// species, the app's own checklist, fixed order) and the plain species list
// (paginated, sortable, the same one the catalogue uses everywhere else).
type SpeciesView = "tree" | "flat";

// The country's own page (flag, counts, description, prev/next) and its birds
// are two separate reads, split by the bottom tabs — the species list would
// otherwise start below a screenful of description.
type TerritoryTab = "info" | "species";

const TerritoryDetailScreen = () => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const width = useContentWidth();
  const { language } = useLanguage();
  const styles = stylesFn(Colors);
  const navigation = useNavigation<AppStackNavigationProp>();
  const route = useRoute<AppStackRouteProp<"TerritoryDetail">>();
  const { segment } = route.params;
  const [tab, setTab] = useState<TerritoryTab>("info");
  const [view, setView] = useState<SpeciesView>("tree");
  // The flat list is an ordinary taxonomy listing, so it follows the
  // catalogue-wide order preference. The tree has no sort of its own — it is
  // taxonomic by definition (same as the checklist screen, allowSort: false).
  const { sort, openSortSheet } = useTaxonomySort();

  const detailQuery = useQuery<TerritoryDetail>({
    queryKey: ["TerritoryDetail", segment, language],
    queryFn: () => fetchTerritoryDetail(segment),
    staleTime: StaleTime.ONE_DAY,
  });

  const data = detailQuery.data;
  // Both species views are keyed by our own Territory.pk, which only the
  // detail response carries — the screen is reached by segment.
  const territoryId = data?.territory_id;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: data?.name ?? t("countries"),
      headerRight: () => (
        <IconsHeader
          headerRightBeginning={[
            {
              condition: true,
              icon: "git-compare-outline",
              onPress: () =>
                navigation.navigate("TerritoryCompare", { segment1: segment }),
              testID: "compare-territory-button",
            },
          ]}
          onSortPress={
            tab === "species" && view === "flat" ? openSortSheet : undefined
          }
          onSharePress={async () => {
            const url = buildShareUrl(`territory/${segment}/`);
            await Share.share(
              Platform.OS === "ios" ? { url } : { message: url },
            );
          }}
        />
      ),
    });
  }, [navigation, data?.name, segment, t, openSortSheet, tab, view]);

  useEffect(() => {
    if (data?.redirect) {
      navigation.setParams({ segment: data.redirect });
    }
  }, [data?.redirect, navigation]);

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

  const viewTab = (value: SpeciesView, label: string, icon: "git-branch-outline" | "list-outline") => (
    <Pressable
      style={[styles.viewTab, view === value && styles.viewTabActive]}
      onPress={() => setView(value)}
      testID={`species-view-${value}`}
    >
      <Ionicons
        name={icon}
        size={15}
        color={view === value ? Colors.main100 : Colors.textSecondary}
      />
      <Text
        style={[styles.viewTabText, view === value && styles.viewTabTextActive]}
      >
        {label}
      </Text>
    </Pressable>
  );

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
    <View style={styles.viewTabs}>
      {viewTab("tree", t("by_groups"), "git-branch-outline")}
      {viewTab("flat", t("species"), "list-outline")}
    </View>
  );

  const speciesContent =
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
    ) : view === "tree" ? (
      <TerritoryChecklist territoryId={territoryId} listHeader={viewSwitch} />
    ) : (
      <TaxonChildrenList
        rank={5}
        traits={{ territory: territoryId }}
        sort={sort}
        errorTitle={t("taxonomy_unavailable")}
        emptyMessage={t("no_species_found")}
        searchPlaceholder={t("search_species_hint")}
        listHeader={viewSwitch}
      />
    );

  return (
    <Layout
      bottom={
        <Tabs
          tabOptions={[
            {
              value: "info" as const,
              icon: "information-circle" as const,
              iconInactive: "information-circle-outline" as const,
              labelKey: t("description"),
            },
            {
              value: "species" as const,
              icon: "leaf" as const,
              iconInactive: "leaf-outline" as const,
              labelKey: t("species"),
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
    viewTabs: {
      flexDirection: "row",
      gap: 6,
      marginBottom: 8,
    },
    viewTab: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: Colors.primary100,
    },
    viewTabActive: { backgroundColor: Colors.main300 },
    viewTabText: {
      fontSize: 13,
      fontWeight: "600",
      color: Colors.textSecondary,
    },
    viewTabTextActive: { color: Colors.main100 },
  });
