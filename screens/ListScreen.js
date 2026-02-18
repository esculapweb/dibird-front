import { useState, useEffect, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import LoadingOverlay from "../components/ui/LoadingOverlay";
import FilterModal from "../components/Filters/FilterModal";
import SortModal from "../components/Sort/SortModal";
import {
  loadFilters,
  clearFilters,
  loadSort,
  saveFilters,
} from "../util/storageHelper";
import { normalizeValue } from "../util/fetches";
import SearchInput from "../components/ui/SearchInput";
import { useDebounce } from "../util/useDebounce";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import FiltersHeader from "../components/ui/FiltersHeader";
import { useList } from "../hooks/useList";
import ItemsList from "../components/ui/ItemsList";
import HeaderTitleWithBadge from "../components/ui/HeaderTitleWithBadge";
import FilterChips from "../components/Filters/FilterChips";

const ListScreen = ({
  route,
  navigation,
  fetchFunction,
  sortOptions,
  allowedFilters,
  errorTitle,
  onAdd,
  ItemCard,
  noItems,
  showSearch,
  title,
}) => {
  const { t } = useTranslation();

  const [filters, setFilters] = useState(null);
  const [sort, setSort] = useState(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const screenName = route.name;

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
    fetchFunction,
    filters,
    sort,
    search: debouncedSearch,
  });
  const items = data?.pages.flatMap((page) => page.results) ?? [];

  const hasActiveFilters = filters
    ? Object.values(filters).some((v) =>
        Array.isArray(v) ? v.length > 0 : v != null && v !== "",
      )
    : false;

  const isEmpty = items.length === 0;
  const isSearchActive = debouncedSearch.length > 0;

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

  const handleClearFilters = async () => {
    setFilters({});
    await clearFilters(screenName);
    setFilterModalVisible(false);
  };

  const handleClearSearch = () => setSearch("");

  const handleClearFiltersSearch = () => {
    handleClearSearch();
    handleClearFilters();
  };

  const handleFilterPress = () => setFilterModalVisible(true);
  const handleSortPress = () => setSortModalVisible(true);

  const removeFilter = (key) => {
    setFilters((prev) => {
      const newFilters = { ...prev };
      newFilters[key] = undefined;
      if (key === "territory") {
        newFilters.place = undefined;
        newFilters.species = undefined;
      }
      saveFilters(screenName, newFilters);
      return newFilters;
    });
  };

  const headerRight = useCallback(
    () => (
      <FiltersHeader
        hasActiveFilters={hasActiveFilters}
        onSortPress={handleSortPress}
        onFilterPress={handleFilterPress}
      />
    ),
    [filters, sort],
  );

  useEffect(() => {
    const initFilters = async () => {
      const storedFilters = await loadFilters(screenName);
      setFilters(storedFilters ?? {});
      setFiltersLoaded(true);
    };
    initFilters();
  }, []);

  useEffect(() => {
    const initSort = async () => {
      const storedSort = await loadSort(screenName);
      setSort(
        normalizeValue(
          storedSort,
          sortOptions.map((item) => item.value),
        ),
      );
    };
    initSort();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!filtersLoaded) return;

      const { placeId, territoryId } = route.params ?? {};
      if (!placeId || !territoryId) return;

      setFilters((prev) => {
        const newFilters = {
          ...(prev ?? {}),
          territory: territoryId,
          place: placeId,
          species: null,
        };

        saveFilters(screenName, newFilters);
        return newFilters;
      });

      navigation.setParams({
        placeId: undefined,
        territoryId: undefined,
      });
    }, [route.params?.placeId, filtersLoaded]),
  );

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <HeaderTitleWithBadge
          title={title}
          badgeCount={data?.pages[0]?.pagination?.count ?? 0}
        />
      ),
      headerRight,
    });
  }, [navigation, headerRight, data]);

  if (isError)
    return (
      <ErrorOverlay
        title={errorTitle}
        message={error.message}
        onPress={refetch}
        logo
      />
    );
  if (isLoading || !filters || !sort) return <LoadingOverlay />;

  return (
    <>
      {showSearch && (
        <SearchInput
          value={search}
          onChange={setSearch}
          onClear={handleClearSearch}
          placeholder={t("search_by_name")}
        />
      )}
      {hasActiveFilters && (
        <FilterChips filters={filters} onRemove={removeFilter} />
      )}
      <ItemsList
        data={items}
        screen={screenName}
        onEndReached={handleLoadMore}
        isLoadingMore={isFetchingNextPage}
        onAdd={onAdd}
        emptyType={emptyType}
        onClear={handleClearFiltersSearch}
        ItemCard={ItemCard}
        noItems={noItems}
      />
      <SortModal
        screen={screenName}
        options={sortOptions}
        visible={sortModalVisible}
        onClose={() => setSortModalVisible(false)}
        sort={sort}
        setSort={setSort}
      />
      <FilterModal
        screen={screenName}
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        filters={filters}
        allowed={allowedFilters}
        setFilters={setFilters}
        clearFilters={handleClearFilters}
      />
    </>
  );
};

export default ListScreen;
