import { useCallback, useLayoutEffect, useState } from "react";
import { Platform, Pressable, Share, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { track } from "../services/analytics";
import { useNavigation, useRoute } from "@react-navigation/native";

import Layout from "../components/ui/Layout";
import IconsHeader from "../components/ui/IconsHeader";
import ItemsList from "../components/ui/ItemsList";
import SearchInput from "../components/ui/SearchInput";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import TerritoryRow from "../components/Territory/TerritoryRow";
import RegionFilterChips from "../components/Territory/RegionFilterChips";
import { useList } from "../hooks/useList";
import { useDebounce } from "../hooks/useDebounce";
import { useScreenSort } from "../hooks/useScreenSort";
import { callNavigationCallback } from "../util/navigationCallbacks";
import { fetchTerritoryList } from "../util/fetches";
import { langBaseUrl } from "../util/helpers";
import { StaleTime } from "../constants/staleTime";
import { useTheme, ThemeColors } from "../store/theme-context";
import {
  CatalogNavigationProp,
  CatalogRouteProp,
  TerritoryListItem,
} from "../types";

// Website URL for the country list. Param names match /api/territory/ (which
// the site's own page forwards), so the same link filters and sorts there too.
// Built here rather than through buildShareUrl because that helper only knows
// how to append the observation-style filter set.
export const buildTerritoryListUrl = (
  region: number | null,
  sort: string | null,
  search?: string | null,
): string => {
  const params = new URLSearchParams();
  if (region != null) params.set("region", String(region));
  if (sort) params.set("o", sort);
  // Same `name` the taxonomy catalogue shares its search box with.
  if (search) params.set("name", search);
  const query = params.toString();
  return `${langBaseUrl()}/territory/${query ? `?${query}` : ""}`;
};

const TerritoryListScreen = () => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const navigation = useNavigation<CatalogNavigationProp>();
  const route = useRoute<CatalogRouteProp<"TerritoryList">>();
  const { pickerKey, title, initialSort, initialSearch, initialRegion } =
    route.params ?? {};

  // A shared link can pin the sort; the hook drops the pin once the user picks
  // their own order, so the sort control keeps working.
  const { sort, openSortSheet } = useScreenSort("Territory", initialSort);
  const [search, setSearch] = useState(initialSearch ?? "");
  const [region, setRegion] = useState<number | null>(initialRegion ?? null);
  const debouncedSearch = useDebounce(search);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    isRefetching,
    error,
    refetch,
  } = useList<TerritoryListItem>({
    // The region lives inside fetchTerritoryList's closure, which useList
    // can't see — it has to be part of the query key here, or react-query
    // keeps serving the pages it already has for another region.
    screenName: `TerritoryList-${region ?? "all"}`,
    fetchFunction: fetchTerritoryList(region),
    filters: {},
    sort,
    search: debouncedSearch,
    enabled: true,
    staleTime: StaleTime.ONE_DAY,
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      title: title ?? t("countries"),
      headerRight: () => (
        <IconsHeader
          onSortPress={openSortSheet}
          // The picker is a transient sub-screen of the compare page, and the
          // site has no URL for it.
          onSharePress={
            pickerKey
              ? undefined
              : async () => {
                  const url = buildTerritoryListUrl(region, sort, search);
                  track("share_tapped", { type: "territory_list" });
                  await Share.share(
                    Platform.OS === "ios" ? { url } : { message: url },
                  );
                }
          }
        />
      ),
    });
    // region and search belong here: the share button captures them, so
    // without them it keeps handing out the URL of the list as it was when
    // the screen opened.
  }, [navigation, title, t, openSortSheet, pickerKey, sort, region, search]);

  const items = data?.pages.flatMap((page) => page.results) ?? [];

  // Both of these are props of a FlatList cell (which is a PureComponent), so
  // a new identity on every render of this screen — every keystroke in the
  // search field — re-renders every mounted row.
  const handlePress = useCallback(
    (item: TerritoryListItem) => {
      if (pickerKey) {
        callNavigationCallback(pickerKey, item);
        navigation.goBack();
        return;
      }
      navigation.navigate("TerritoryDetail", { segment: item.segment });
    },
    [pickerKey, navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: TerritoryListItem }) => (
      <TerritoryRow item={item} onPress={handlePress} />
    ),
    [handlePress],
  );

  if (isError && !data)
    return (
      <ErrorOverlay
        title={t("countries_unavailable")}
        message={error.message}
        onPress={async () => {
          await refetch();
        }}
        logo
      />
    );

  if (isLoading || !data) return <LoadingOverlay />;

  return (
    <Layout>
      <ItemsList
        data={items}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        isLoadingMore={isFetchingNextPage}
        renderItem={renderItem}
        keyExtractor={(item) => item.segment}
        emptyType={debouncedSearch || region != null ? "filtered" : "initial"}
        onClear={() => {
          setSearch("");
          setRegion(null);
        }}
        noItems={{ icon: "globe-outline", message: t("no_countries_found") }}
        onRefresh={refetch}
        isRefreshing={isRefetching}
        listHeader={
          <>
            {!pickerKey && (
              <Pressable
                style={styles.shortcut}
                onPress={() => navigation.navigate("TerritoryCompare", undefined)}
                testID="compare-territories-shortcut"
              >
                <Ionicons
                  name="git-compare-outline"
                  size={18}
                  color={Colors.main100}
                />
                <Text style={styles.shortcutText}>
                  {t("compare_territories")}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={Colors.main100}
                />
              </Pressable>
            )}
            <SearchInput
              value={search}
              onChange={setSearch}
              onClear={() => setSearch("")}
              placeholder={t("search_country_hint")}
            />
            <RegionFilterChips value={region} onChange={setRegion} />
          </>
        }
      />
    </Layout>
  );
};

export default TerritoryListScreen;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    shortcut: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: Colors.main300,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 4,
    },
    shortcutText: {
      flex: 1,
      fontSize: 14,
      fontWeight: "600",
      color: Colors.main100,
    },
  });
