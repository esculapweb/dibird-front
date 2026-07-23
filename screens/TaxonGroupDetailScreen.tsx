import { useEffect, useLayoutEffect, useMemo } from "react";
import { Share, StyleSheet, Text, View, Platform } from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import Layout from "../components/ui/Layout";
import IconsHeader from "../components/ui/IconsHeader";
import TaxonChildrenList from "../components/Taxonomy/TaxonChildrenList";
import TaxonDescendantsList from "../components/Taxonomy/TaxonDescendantsList";
import TaxonBreadcrumbs from "../components/Taxonomy/TaxonBreadcrumbs";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import { useTaxonomySort } from "../hooks/useTaxonomySort";
import { fetchTaxonDetail } from "../util/fetches";
import { buildShareUrl } from "../util/helpers";
import { resolveTaxonImage } from "../util/taxonomy";
import { StaleTime } from "../constants/staleTime";
import { useLanguage } from "../store/language-context";
import { useTheme, ThemeColors } from "../store/theme-context";
import {
  AppStackNavigationProp,
  AppStackRouteProp,
  TaxonGroupDetail,
} from "../types";

const CHILD_RANK_TITLE_KEY: Record<number, string> = {
  3: "families",
  4: "species",
  5: "species",
};

const SHARE_PATH: Record<number, string> = {
  2: "order",
  3: "family",
  4: "genus",
};

const TaxonGroupDetailScreen = () => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const { language } = useLanguage();
  const navigation = useNavigation<AppStackNavigationProp>();
  const route = useRoute<AppStackRouteProp<"TaxonGroupDetail">>();
  const { segment, rank, initialSort } = route.params;
  const styles = stylesFn(Colors);
  const { sort, openSortSheet } = useTaxonomySort(initialSort);

  const { data, isLoading, isError, isRefetching, error, refetch } =
    useQuery<TaxonGroupDetail>({
      queryKey: ["TaxonGroupDetail", segment, rank, language],
      queryFn: () => fetchTaxonDetail<TaxonGroupDetail>(segment, rank),
      staleTime: StaleTime.ONE_DAY,
    });

  useLayoutEffect(() => {
    navigation.setOptions({
      title: data?.name_lang ?? t("species"),
      headerRight: () => (
        <IconsHeader
          onSortPress={openSortSheet}
          onSharePress={async () => {
            // Carry the current sort so the shared link reopens in the same
            // order (parsed back via matchTaxonPath's `o` in linking.ts).
            const url = buildShareUrl(
              `${SHARE_PATH[rank]}/${segment}/`,
              null,
              sort,
            );
            await Share.share(
              Platform.OS === "ios" ? { url } : { message: url },
            );
          }}
        />
      ),
    });
  }, [navigation, data?.name_lang, rank, segment, t, openSortSheet, sort]);

  useEffect(() => {
    if (data?.redirect) {
      navigation.setParams({ segment: data.redirect });
    }
  }, [data?.redirect, navigation]);

  // Already-localized, number-agreed labels keyed by child rank
  // ({"5": "446 species"}) — shown in taxonomic order, deepest last.
  const countLabels = useMemo(
    () =>
      Object.entries(data?.count ?? {})
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([, label]) => label),
    [data?.count],
  );

  if (isError && !data)
    return (
      <ErrorOverlay
        title={t("taxonomy_unavailable")}
        message={error.message}
        onPress={async () => {
          await refetch();
        }}
        logo
      />
    );

  if (isLoading || !data || data.redirect) return <LoadingOverlay />;

  // Genera carry no illustration of their own, so borrow the first species
  // photo in the subtree rather than showing an empty frame.
  const heroUri =
    resolveTaxonImage(data.metadata?.image) ??
    resolveTaxonImage(data.descendants?.find((d) => d.thumb)?.thumb);

  const header = (
    <View style={styles.header}>
      {!!heroUri && (
        // Flickr crops vary wildly (portrait and landscape), and a plain
        // "cover" fill left many birds cut down to a torso — show the photo
        // whole over a blurred copy of itself instead.
        <View style={styles.hero}>
          <Image
            source={{ uri: heroUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            blurRadius={30}
            cachePolicy="disk"
          />
          <Image
            source={{ uri: heroUri }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            cachePolicy="disk"
          />
        </View>
      )}

      <TaxonBreadcrumbs parents={data.parents ?? []} />

      <Text style={styles.title}>{data.name_lang}</Text>
      {data.latin_name !== data.name_lang && (
        <Text style={styles.latin}>{data.latin_name}</Text>
      )}

      {countLabels.length > 0 && (
        <View style={styles.chipsRow}>
          {countLabels.map((label) => (
            <View key={label} style={styles.chip}>
              <Text style={styles.chipText}>{label}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.childrenTitle}>
        {t(CHILD_RANK_TITLE_KEY[rank + 1])}
      </Text>
    </View>
  );

  return (
    <Layout>
      {/* An order's families come from the paginated list endpoint; family and
          genus details already ship their whole subtree (genera + species) in
          `descendants`, so those render grouped by genus like the web does. */}
      {rank === 2 ? (
        <TaxonChildrenList
          rank={3}
          parent={{ segment, rank }}
          sort={sort}
          errorTitle={t("taxonomy_unavailable")}
          emptyMessage={t("no_families_found")}
          listHeader={header}
        />
      ) : (
        <TaxonDescendantsList
          descendants={data.descendants ?? []}
          showGroupHeaders={rank === 3}
          sort={sort}
          emptyMessage={t("no_species_found")}
          listHeader={header}
          onRefresh={refetch}
          isRefreshing={isRefetching}
        />
      )}
    </Layout>
  );
};

export default TaxonGroupDetailScreen;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    header: { marginBottom: 4, paddingHorizontal: 4 },
    hero: {
      width: "100%",
      height: 180,
      borderRadius: 14,
      overflow: "hidden",
      backgroundColor: Colors.imageBg,
      marginBottom: 12,
    },
    title: {
      fontSize: 22,
      fontWeight: "700",
      color: Colors.textMain,
    },
    latin: {
      fontSize: 14,
      fontStyle: "italic",
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
    childrenTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: Colors.textSecondary,
      textTransform: "uppercase",
      marginTop: 12,
      marginBottom: 6,
    },
  });
