import { useEffect, useCallback, useLayoutEffect, ReactNode } from "react";
import {
  StyleSheet,
  Pressable,
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
import SearchInput from "../components/ui/SearchInput";
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
  handleSharePress?: () => Promise<void>;
  fabIcon?: IconType;
  getItemId?: (item: T) => string | number;
  onFiltersChange?: (val: Filters | null) => Promise<void>;
  onSortChange?: (val: string | null) => Promise<void>;
  locationCoords?: Coords | null;
  locationAvailable?: boolean;
  onLocationUnavailable?: () => void;
  allowSort?: boolean;
  onOpenFilterModal?: (fn: () => void) => void;
  showHeaderBadge?: boolean;
  customHeaderBadge?: (
    res: StatPaginatedResponse<T>,
  ) => string | number | undefined;
  topEl?: ReactNode;
  bottomEl?: ReactNode;
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
  handleSharePress,
  fabIcon,
  getItemId,
  onFiltersChange,
  onSortChange,
  locationCoords,
  locationAvailable = true,
  onLocationUnavailable,
  allowSort = true,
  onOpenFilterModal,
  showHeaderBadge = true,
  customHeaderBadge,
  topEl,
  bottomEl,
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
    handleClearSearch,
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
    enabled: sortReady && filtersLoaded,
  });

  useEffect(() => {
    if (data?.pages[0]) {
      onFirstPageData?.(data.pages[0] as StatPaginatedResponse<T>);
    }
  }, [data?.pages[0], onFirstPageData]);

  const rawItems = data?.pages.flatMap((page) => page.results) ?? [];
  const objects = new Set();
  const items = rawItems.filter((item) => {
    const id = resolvedGetItemId(item);
    if (objects.has(id)) return false;
    objects.add(id);
    return true;
  });

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
    handleSharePress ? 1 : 0,
    ...(headerRightEnd || []),
  ].filter(Boolean).length;

  useEffect(() => {
    onFiltersChange?.(filters);
  }, [filters]);

  useEffect(() => {
    onSortChange?.(sort);
  }, [sort]);

  useEffect(() => {
    onOpenFilterModal?.(() =>
      BottomSheet.showContent({
        title: t("filters"),
        onReset: handleClearFilters,
        renderContent: (dismiss) => (
          <FilterSheetContent
            filters={filters}
            allowed={allowedFilters}
            setFilters={handleFiltersApplied}
            extraTerritory={extraFilters?.territory}
            dismiss={dismiss}
          />
        ),
      }),
    );
  }, [
    filters,
    allowedFilters,
    handleFiltersApplied,
    handleClearFilters,
    extraFilters,
  ]);

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
          onSortPress={
            allowSort
              ? () =>
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
                  })
              : undefined
          }
          onFilterPress={() =>
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
                />
              ),
            })
          }
          onSharePress={handleSharePress}
          headerRightBeginning={headerRightBeginning}
          headerRightEnd={headerRightEnd}
        />
      ),
    });
  }, [
    navigation,
    hasActiveFilters,
    allowSort,
    handleSharePress,
    headerRightBeginning,
    headerRightEnd,
    sort,
    locationAvailable,
    handleClearFilters,
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

  const searchEl = showSearch && (
    <SearchInput
      value={search}
      onChange={setSearch}
      onClear={handleClearSearch}
      placeholder={t("search_by_name")}
    />
  );

  if (isError)
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
            <Pressable style={styles.fab} onPress={onAdd}>
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
      top={topEl ?? searchEl}
    >
      {hasActiveFilters && (
        <FilterChips
          filters={filters}
          onRemove={removeFilter}
          extraFilters={extraFilters}
          hints={filterHints}
          allowed={allowedFilters}
        />
      )}
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
      />
    </Layout>
  );
};

export default ListScreen;

const stylesFn = (Colors: ThemeColors, fabBottomOffset: number) =>
  StyleSheet.create({
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
