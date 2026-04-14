import {
  useState,
  useEffect,
  useCallback,
  useLayoutEffect,
  useRef,
} from "react";
import { useTranslation } from "react-i18next";

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

const ListScreen = ({
  route,
  navigation,
  fetchFunction,
  allowedFilters = ["territory", "place", "date", "species"],
  errorTitle,
  onAdd,
  renderItem,
  noItems,
  showSearch,
  title,
  tabsMode,
  listHeader,
  extraFilters,
  headerRightBeginning,
  headerRightEnd,
  handleSharePress,
  fabOffset,
  fabIcon,
  getItemId = (item) => item.id,
  onFiltersChange,
  onSortChange,
  locationCoords,
  locationAvailable = true,
  permissionStatus,
  onLocationUnavailable,
  screenNameOverride,
  allowSort = true,
  onOpenFilterModal,
  showHeaderBadge = true,
  topEl,
  bottomEl,
  bottomHeight
}) => {
  const screenName = screenNameOverride ?? route.name;
  const { t } = useTranslation();
  const keyExtractor = (item, _) => `${screenName}-${getItemId(item)}`;
  const [sortModalVisible, setSortModalVisible] = useState(false);

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
    permissionStatus,
    allowedFilters,
  });

  const hasActiveFiltersRef = useRef(hasActiveFilters);
  useEffect(() => {
    hasActiveFiltersRef.current = hasActiveFilters;
  }, [hasActiveFilters]);

  useEffect(() => {
    onOpenFilterModal?.(() => setFilterModalVisible(true));
  }, []);

  const fetchDataWrapper = useCallback(
    (filters, sort, search, page) => {
      return fetchFunction(
        filters,
        sort,
        search,
        page,
        () => setFilterModalVisible(true),
        locationCoords,
      );
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
    const id = getItemId(item);
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
      : null;

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const headerRight = () => (
    <IconsHeader
      hasActiveFilters={hasActiveFiltersRef.current}
      onSortPress={allowSort ? () => setSortModalVisible(true) : null}
      onFilterPress={() => setFilterModalVisible(true)}
      onSharePress={handleSharePress}
      headerRightBeginning={headerRightBeginning}
      headerRightEnd={headerRightEnd}
    />
  );

  const headerRightKey = `${!!handleSharePress}-${!!allowSort}-${headerRightBeginning?.length}-${headerRightEnd?.length}`;

  useEffect(() => {
    onFiltersChange?.(filters);
  }, [filters]);

  useEffect(() => {
    onSortChange?.(sort);
  }, [sort]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <HeaderTitleWithBadge
          title={title}
          badgeCount={
            showHeaderBadge
              ? (data?.pages[0]?.pagination?.count ?? 0)
              : undefined
          }
        />
      ),
      headerRight,
    });
  }, [navigation, headerRightKey, data]);

  // const bottomEl = showSearch && (
  //   <SearchInput
  //     value={search}
  //     onChange={setSearch}
  //     onClear={handleClearSearch}
  //     placeholder={t("search_by_name")}
  //   />
  // );

  if (isError)
    return (
      <ErrorOverlay
        title={errorTitle}
        message={error.message}
        onPress={refetch}
        logo
      />
    );
  if (isLoading || !data) return <LoadingOverlay />;

  return (
    <Layout keyBoard={true} bottom={bottomEl} bottomHeight={bottomHeight} top={topEl}>
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
        fabOffset={fabOffset}
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
