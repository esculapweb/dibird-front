import { useState, useEffect, useCallback, useLayoutEffect } from "react";
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
  fabIcon,
  getItemId = (item) => item.id,
  onFiltersChange,
  onSortChange,
  locationCoords,
  locationAvailable = true,
  onLocationUnavailable,
  screenNameOverride,
  allowSort = true,
  onOpenFilterModal,
  showHeaderBadge = true,
  topEl,
  bottomEl,
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
    allowedFilters,
  });

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
          onSortPress={allowSort ? () => setSortModalVisible(true) : null}
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
        onPress={refetch}
        logo
      />
    );
  if (isLoading || !data) return <LoadingOverlay />;

  return (
    <Layout keyBoard={true} bottom={bottomEl} top={topEl ?? searchEl}>
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
