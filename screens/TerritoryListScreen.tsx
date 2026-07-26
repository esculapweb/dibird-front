import { useLayoutEffect, useState } from "react";
import { Platform, Pressable, Share, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
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
  AppStackNavigationProp,
  AppStackRouteProp,
  TerritoryListItem,
} from "../types";

// Website URL for the country list. Param names match /api/territory/ (which
// the site's own page forwards), so the same link filters and sorts there too.
// Built here rather than through buildShareUrl because that helper only knows
// how to append the observation-style filter set.
export const buildTerritoryListUrl = (
  region: number | null,
  sort: string | null,
): string => {
  const params = new URLSearchParams();
  if (region != null) params.set("region", String(region));
  if (sort) params.set("o", sort);
  const query = params.toString();
  return `${langBaseUrl()}/territory/${query ? `?${query}` : ""}`;
};

const TerritoryListScreen = () => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const navigation = useNavigation<AppStackNavigationProp>();
  const route = useRoute<AppStackRouteProp<"TerritoryList">>();
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
                  const url = buildTerritoryListUrl(region, sort);
                  await Share.share(
                    Platform.OS === "ios" ? { url } : { message: url },
                  );
                }
          }
        />
      ),
    });
  }, [navigation, title, t, openSortSheet, pickerKey, sort]);

  const items = data?.pages.flatMap((page) => page.results) ?? [];

  const handlePress = (item: TerritoryListItem) => {
    if (pickerKey) {
      callNavigationCallback(pickerKey, item);
      navigation.goBack();
      return;
    }
    navigation.navigate("TerritoryDetail", { segment: item.segment });
  };

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
        renderItem={({ item }) => (
          <TerritoryRow
            name={item.name}
            code={item.code}
            regionName={item.region_name}
            speciesLabel={item.count?.["5"]}
            onPress={() => handlePress(item)}
          />
        )}
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
