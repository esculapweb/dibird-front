import {
  useEffect,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import {
  StyleSheet,
  Pressable,
  View,
  ListRenderItem,
  FlatListProps,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import LoadingOverlay from "../components/ui/LoadingOverlay";
import FilterSheetContent from "../components/Filters/FilterSheetContent";
import SortSheetContent from "../components/Sort/SortSheetContent";
import IconsHeader from "../components/ui/IconsHeader";
import FilterChips from "../components/Filters/FilterChips";
import { useList } from "../hooks/useList";
import ItemsList from "../components/ui/ItemsList";
import HeaderTitleWithBadge from "../components/ui/HeaderTitleWithBadge";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import { useSyncedFilters } from "../hooks/useSyncedFilters";
import { useTheme, ThemeColors } from "../store/theme-context";
import Layout from "../components/ui/Layout";
import { BottomSheet } from "../services/bottomSheet";
import {
  AppStackNavigationProp,
  ScreenWithFiltersParamList,
  ScreenWithFiltersOnly,
  AllowedFilterKey,
  seenMode,
  Filters,
  IconType,
  IconButtonConfig,
  EmptyStateProps,
  FetchFunction,
  Coords,
  StatPaginatedResponse,
} from "../types";

interface ListScreenProps<T, RouteName extends ScreenWithFiltersOnly> {
  route: RouteProp<ScreenWithFiltersParamList, RouteName>;
  fetchFunction: FetchFunction<T>;
  allowedFilters?: AllowedFilterKey[];
  errorTitle: string;
  onAdd?: () => void;
  renderItem: ListRenderItem<T>;
  noItems: EmptyStateProps;
  showSearch?: boolean;
  title: string;
  tabsMode?: seenMode;
  listHeader?: FlatListProps<T>["ListHeaderComponent"];
  extraFilters?: Filters | null;
  headerRightBeginning?: IconButtonConfig[];
  headerRightEnd?: IconButtonConfig[];
  fabIcon?: IconType;
  getItemId?: (item: T) => string | number;
  onFiltersChange?: (val: Filters | null) => Promise<void>;
  onSortChange?: (val: string | null) => Promise<void>;
  locationCoords?: Coords | null;
  locationAvailable?: boolean;
  onLocationUnavailable?: () => void;
  allowSort?: boolean;
  staleTime?: number;
  onOpenFilterModal?: (fn: () => void) => void;
  showHeaderBadge?: boolean;
  customHeaderBadge?: (
    res: StatPaginatedResponse<T>,
  ) => string | number | undefined;
  // Something the screen's own fetchFunction varies by, beyond filters/sort/
  // search — see useList's queryKeyExtra.
  queryKeyExtra?: string | null;
  topEl?: ReactNode;
  bottomEl?: ReactNode;
  // Draws the loaded items itself instead of the standard scrolling list, for
  // a screen whose data reads as something other than rows (the observations
  // map). Everything around it — filters, chips, header badge, the error and
  // loading overlays — stays shared, which is the point of routing a map
  // through ListScreen at all. Infinite scroll has no meaning here, so a
  // fetchFunction paired with this one is expected to return everything at
  // once (see fetchObservationPlaces).
  //
  // `empty` carries what ItemsList would have used to pick an empty state, so
  // a custom body can tell "nothing here yet" from "nothing matches the
  // filters" without recomputing it.
  renderContent?: (
    items: T[],
    empty: { type?: "filtered" | string; onClear: () => void },
  ) => ReactNode;
  fabBottomOffset?: number;
  onFirstPageData?: (page: StatPaginatedResponse<T>) => void;
}

const ListScreen = <T, RouteName extends ScreenWithFiltersOnly>({
  route,
  fetchFunction,
  allowedFilters = ["territory", "place", "date", "species"],
  errorTitle,
  onAdd,
  renderItem,
  noItems,
  showSearch = false,
  title,
  tabsMode,
  listHeader,
  extraFilters,
  headerRightBeginning,
  headerRightEnd,
  fabIcon,
  getItemId,
  onFiltersChange,
  onSortChange,
  locationCoords,
  locationAvailable = true,
  onLocationUnavailable,
  allowSort = true,
  staleTime,
  onOpenFilterModal,
  showHeaderBadge = true,
  customHeaderBadge,
  queryKeyExtra,
  topEl,
  bottomEl,
  renderContent,
  fabBottomOffset = 0,
  onFirstPageData,
}: ListScreenProps<T, RouteName>) => {
  const screenName = route.name;
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = stylesFn(Colors, fabBottomOffset + insets.bottom);
  const resolvedGetItemId = (item: T): string | number =>
    getItemId
      ? getItemId(item)
      : (item as unknown as { id: string | number }).id;
  const keyExtractor = (item: T, _: number) =>
    `${screenName}-${resolvedGetItemId(item)}`;
  const navigation = useNavigation<AppStackNavigationProp>();

  const {
    filters,
    filtersLoaded,
    hasActiveFilters,
    removeFilter,
    filterHints,
    sort,
    setSort,
    sortOptions,
    sortReady,
    search,
    setSearch,
    debouncedSearch,
    isSearchActive,
    handleFiltersApplied,
    handleClearFilters,
    handleClearFiltersSearch,
  } = useSyncedFilters({
    route,
    navigation,
    screenName,
    allowSort,
    allowedFilters,
  });

  const fetchDataWrapper = useCallback(
    (filters: Filters, sort: string | null, search: string, page: number) => {
      return fetchFunction(filters, sort, search, page, locationCoords);
    },
    [fetchFunction, locationCoords],
  );

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useList({
    screenName,
    fetchFunction: fetchDataWrapper,
    filters,
    sort,
    search: debouncedSearch,
    tabsMode,
    extraFilters,
    locationCoords,
    queryKeyExtra,
    enabled: sortReady && filtersLoaded,
    staleTime,
  });

  useEffect(() => {
    if (data?.pages[0]) {
      onFirstPageData?.(data.pages[0] as StatPaginatedResponse<T>);
    }
  }, [data?.pages[0], onFirstPageData]);

  // The dedup walks every loaded page, and with infinite scroll that grows
  // without bound — no reason to redo it on renders that only changed the
  // search string or a header option. getItemId is left out of the deps on
  // purpose: screens pass it inline, so it is a new function every render and
  // would defeat the memo, while what it returns for a given item never
  // changes.
  const items = useMemo(() => {
    const rawItems = data?.pages.flatMap((page) => page.results) ?? [];
    const objects = new Set();
    return rawItems.filter((item) => {
      const id = resolvedGetItemId(item);
      if (objects.has(id)) return false;
      objects.add(id);
      return true;
    });
  }, [data?.pages]);

  // The pull-to-refresh spinner has to follow the pull, not the query.
  // `isRefetching` is true for *any* background fetch: a page of infinite
  // scroll, or a refetch some other screen started by invalidating with
  // `refetchType: "all"` — which is exactly what saving an observation does
  // (invalidateObservationCaches). Wired straight to RefreshControl that put
  // a spinner over a list nobody pulled, and anything that re-invalidates on
  // a timer (the photo queue's backoff retries) kept putting it back, so it
  // read as a loader that never goes away. Local state instead, the shape
  // MainScreen already uses.
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);

  const handlePullRefresh = useCallback(async () => {
    setIsPullRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsPullRefreshing(false);
    }
  }, [refetch]);

  const isEmpty = items.length === 0;

  const emptyType =
    !isLoading && isEmpty
      ? isSearchActive || hasActiveFilters
        ? "filtered"
        : "initial"
      : undefined;

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const iconCount = [
    ...(headerRightBeginning || []),
    allowSort ? 1 : 0,
    1,
    ...(headerRightEnd || []),
  ].filter(Boolean).length;

  useEffect(() => {
    onFiltersChange?.(filters);
  }, [filters]);

  useEffect(() => {
    onSortChange?.(sort);
  }, [sort]);

  const openFilterSheet = () =>
    BottomSheet.showContent({
      title: t("filters"),
      onReset: handleClearFilters,
      renderContent: (dismiss: () => void) => (
        <FilterSheetContent
          filters={filters}
          allowed={allowedFilters}
          setFilters={handleFiltersApplied}
          extraTerritory={extraFilters?.territory}
          dismiss={dismiss}
          showSearch={showSearch}
          initialSearch={search}
          onSearchChange={setSearch}
        />
      ),
    });

  const openSortSheet = () =>
    BottomSheet.showContent({
      title: t("sort_by"),
      renderContent: (dismiss: () => void) => (
        <SortSheetContent
          screen={screenName}
          options={sortOptions}
          sort={sort}
          setSort={setSort}
          locationAvailable={locationAvailable}
          onLocationUnavailable={onLocationUnavailable}
          dismiss={dismiss}
        />
      ),
    });

  // The header reaches the navigator through setOptions, and it used to be
  // rebuilt on every single render — every dependency list below that named an
  // unmemoised callback (handleClearFilters is a fresh function each render)
  // saw a change each time. A button replaced under the finger swallows the
  // tap, which is what "the sort sheet just doesn't open" looked like.
  //
  // The two openers can't be memoised — they close over filters/search/sort and
  // would go stale the moment the effect stopped re-running — so they live in
  // refs, refreshed on each render, behind the stable callbacks the header and
  // onOpenFilterModal actually receive. Assigning during render rather than in
  // an effect keeps a press that lands before the effect flushes from opening
  // the sheet on the previous render's values.
  const openFilterSheetRef = useRef(openFilterSheet);
  const openSortSheetRef = useRef(openSortSheet);
  openFilterSheetRef.current = openFilterSheet;
  openSortSheetRef.current = openSortSheet;

  const handleFilterPress = useCallback(() => openFilterSheetRef.current(), []);
  const handleSortPress = useCallback(() => openSortSheetRef.current(), []);

  useEffect(() => {
    onOpenFilterModal?.(handleFilterPress);
  }, [onOpenFilterModal, handleFilterPress]);

  const badgeCount = () => {
    if (!data?.pages[0]) return;
    if (customHeaderBadge)
      return customHeaderBadge(data.pages[0] as StatPaginatedResponse<T>);
    if (showHeaderBadge) return data.pages[0]?.pagination?.count ?? 0;
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <IconsHeader
          key={`header-icons-${iconCount}`}
          hasActiveFilters={hasActiveFilters}
          onSortPress={allowSort ? handleSortPress : undefined}
          onFilterPress={handleFilterPress}
          headerRightBeginning={headerRightBeginning}
          headerRightEnd={headerRightEnd}
        />
      ),
    });
  }, [
    navigation,
    hasActiveFilters,
    allowSort,
    iconCount,
    headerRightBeginning,
    headerRightEnd,
    handleFilterPress,
    handleSortPress,
  ]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <HeaderTitleWithBadge
          title={title ?? t(route.name)}
          badgeCount={badgeCount()}
        />
      ),
    });
  }, [navigation, data]);

  // isError also fires when a load-more (page > 1) fetch fails while earlier
  // pages already loaded successfully — react-query keeps `data` populated
  // with those pages in that case. Only replace the whole screen with the
  // error overlay when there's nothing to show yet (page 1 itself failed);
  // otherwise keep the already-loaded items and just let load-more silently
  // stop (hasNextPage still reflects the last successful page, so scrolling
  // to the end will simply retry).
  if (isError && !data)
    return (
      <ErrorOverlay
        title={errorTitle}
        message={error.message}
        onPress={async () => {
          await refetch();
        }}
        logo
      />
    );
  if (isLoading || !data) return <LoadingOverlay />;

  return (
    <Layout
      bottom={
        <>
          {onAdd && (
            <Pressable
              style={styles.fab}
              onPress={onAdd}
              testID="list-add-button"
            >
              <Ionicons
                name={fabIcon ?? "add"}
                size={28}
                color={Colors.textOpposite}
              />
            </Pressable>
          )}
          {bottomEl}
        </>
      }
    >
      {/* topEl sits outside the list, so it misses the padding ItemsList's
          contentContainerStyle gives everything inside it — without this the
          view switch is pressed flat against the navigation header, unlike the
          same switch in the checklist's list header. */}
      {topEl && <View style={styles.topEl}>{topEl}</View>}
      {hasActiveFilters && (
        <FilterChips
          filters={filters}
          onRemove={removeFilter}
          extraFilters={extraFilters}
          hints={filterHints}
          allowed={allowedFilters}
        />
      )}
      {renderContent ? (
        renderContent(items, {
          type: emptyType,
          onClear: handleClearFiltersSearch,
        })
      ) : (
        <ItemsList
          data={items}
          onEndReached={handleLoadMore}
          isLoadingMore={isFetchingNextPage}
          emptyType={emptyType}
          onClear={handleClearFiltersSearch}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          noItems={noItems}
          listHeader={listHeader}
          onRefresh={handlePullRefresh}
          isRefreshing={isPullRefreshing}
        />
      )}
    </Layout>
  );
};

export default ListScreen;

const stylesFn = (Colors: ThemeColors, fabBottomOffset: number) =>
  StyleSheet.create({
    topEl: { paddingTop: 8 },
    fab: {
      position: "absolute",
      bottom: fabBottomOffset,
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: Colors.main100,
      shadowColor: Colors.shadow,
      shadowOpacity: 0.3,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 6,
    },
  });
