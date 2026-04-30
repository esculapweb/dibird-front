import {
  useState,
  useEffect,
  useCallback,
  useLayoutEffect,
  ReactNode,
} from "react";
import { ListRenderItem, FlatListProps } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation, RouteProp } from "@react-navigation/native";

import LoadingOverlay from "../components/ui/LoadingOverlay";
import FilterModal from "../components/Filters/FilterModal";
import SortModal from "../components/Sort/SortModal";
import IconsHeader from "../components/ui/IconsHeader";
import FilterChips from "../components/Filters/FilterChips";
import { useList } from "../hooks/useList";
import ItemsList from "../components/ui/ItemsList";
import HeaderTitleWithBadge from "../components/ui/HeaderTitleWithBadge";
import SearchInput from "../components/ui/SearchInput";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import { useSyncedFilters } from "../hooks/useSyncedFIlters";
import Layout from "../components/ui/Layout";
import {
  AppStackNavigationProp,
  ScreenWithFiltersParamList,
  ScreenWithFiltersOnly,
  FilterKey,
  seenMode,
  Filters,
  IconType,
  IconButtonConfig,
  EmptyStateProps,
  FetchFunction,
  Coords,
} from "../types";

interface ListScreenProps<T, RouteName extends ScreenWithFiltersOnly> {
  route: RouteProp<ScreenWithFiltersParamList, RouteName>;
  fetchFunction: FetchFunction<T>;
  allowedFilters?: FilterKey[];
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
  topEl?: ReactNode;
  bottomEl?: ReactNode;
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
  topEl,
  bottomEl,
}: ListScreenProps<T, RouteName>) => {
  const screenName = route.name;
  const { t } = useTranslation();
  const resolvedGetItemId = (item: T): string | number =>
    getItemId
      ? getItemId(item)
      : (item as unknown as { id: string | number }).id;
  const keyExtractor = (item: T, _: number) =>
    `${screenName}-${resolvedGetItemId(item)}`;
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const navigation = useNavigation<AppStackNavigationProp>();

  const {
    filters,
    filtersLoaded,
    filterModalVisible,
    setFilterModalVisible,
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

  useEffect(() => {
    onOpenFilterModal?.(() => setFilterModalVisible(true));
  }, []);

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

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <IconsHeader
          key={`header-icons-${iconCount}`}
          hasActiveFilters={hasActiveFilters}
          onSortPress={allowSort ? () => setSortModalVisible(true) : undefined}
          onFilterPress={() => setFilterModalVisible(true)}
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
  ]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <HeaderTitleWithBadge
          title={title ?? t(route.name)}
          badgeCount={
            showHeaderBadge
              ? (data?.pages[0]?.pagination?.count ?? 0)
              : undefined
          }
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
    <Layout bottom={bottomEl} top={topEl ?? searchEl}>
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
        onAdd={onAdd}
        emptyType={emptyType}
        onClear={handleClearFiltersSearch}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        noItems={noItems}
        listHeader={listHeader}
        fabIcon={fabIcon}
      />
      <SortModal
        screen={screenName}
        options={sortOptions}
        visible={sortModalVisible}
        onClose={() => setSortModalVisible(false)}
        sort={sort}
        setSort={setSort}
        locationAvailable={locationAvailable}
        onLocationUnavailable={onLocationUnavailable}
      />
      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        filters={filters}
        allowed={allowedFilters}
        setFilters={handleFiltersApplied}
        clearFilters={handleClearFilters}
        extraTerritory={extraFilters?.territory}
      />
    </Layout>
  );
};

export default ListScreen;
