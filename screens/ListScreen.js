import { useState, useEffect, useCallback, useLayoutEffect } from "react";
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
import FiltersHeader from "../components/ui/FiltersHeader";
import FilterChips from "../components/Filters/FilterChips";

import { normalizeValue } from "../util/helpers";
import { useList } from "../hooks/useList";
import ItemsList from "../components/ui/ItemsList";
import HeaderTitleWithBadge from "../components/ui/HeaderTitleWithBadge";
import SearchInput from "../components/ui/SearchInput";
import { useDebounce } from "../util/useDebounce";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import { sortOptionsList } from "../util/sortOptionsList";
import { parseDeepLinkParams } from "../util/parseDeepLinkParams";
import { useFilters } from "../store/filters-context";
import { useProfile } from "../store/profile-context";

const ListScreen = ({
  route,
  navigation,
  fetchFunction,
  allowedFilters = ["territory", "place", "date", "species"],
  noSaveFilters = [],
  errorTitle,
  onAdd,
  renderItem,
  noItems,
  showSearch,
  title,
  tabs,
  tabsMode,
  listHeader,
  extraFilters,
  headerRightExtra,
  fabOffset,
  getItemId = (item) => item.id,
  onFiltersChange,
  locationCoords,
  locationAvailable = true,
  permissionStatus,
  onLocationUnavailable,
}) => {
  const { t } = useTranslation();
  const { territory, setTerritory, date, setDate } = useFilters();
  const { profile } = useProfile();

  const translations = [
    t("territory"),
    t("place"),
    t("species_single"),
    t("favourite"),
    t("yes"),
    t("no"),
    t("date"),
    t("year"),
  ];

  const [filters, setFilters] = useState(null);
  const [sort, setSort] = useState(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const screenName = route.name;
  const sortOptions = sortOptionsList(screenName);
  const [filterHints, setFilterHints] = useState({});

  const keyExtractor = (item, _) => `${screenName}-${getItemId(item)}`;

  const fetchDataWrapper = (filters, sort, search, page) => {
    return fetchFunction(
      filters,
      sort,
      search,
      page,
      () => setFilterModalVisible(true),
      locationCoords,
    );
  };

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
  });
  const rawItems = data?.pages.flatMap((page) => page.results) ?? [];
  const objects = new Set();
  const items = rawItems.filter((item) => {
    const id = getItemId(item);
    if (objects.has(id)) return false;
    objects.add(id);
    return true;
  });

  const hasActiveFilters = filters
    ? Object.values(filters).some((v) =>
        Array.isArray(v) ? v.length > 0 : v != null && v !== "",
      )
    : false;

  const isEmpty = items.length === 0;
  const isSearchActive = debouncedSearch.length > 0;
  const isDistanceSort = (val) => val === "distance" || val === "-distance";

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

  const handleFiltersApplied = (newFilters) => {
    setFilters(newFilters);
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
    if (key === "date") setDate(null);
    if (key === "territory") setTerritory(null);

    setFilters((prev) => {
      const newFilters = { ...prev };
      newFilters[key] = undefined;
      if (key === "territory") {
        newFilters.place = undefined;
        newFilters.species = undefined;
      }
      const filtersToSave = Object.fromEntries(
        Object.entries(newFilters).filter(([k]) => !noSaveFilters.includes(k)),
      );
      saveFilters(screenName, filtersToSave);
      return newFilters;
    });
  };

  const headerRight = useCallback(
    () => (
      <FiltersHeader
        hasActiveFilters={hasActiveFilters}
        onSortPress={handleSortPress}
        onFilterPress={handleFilterPress}
        headerRightExtra={headerRightExtra}
      />
    ),
    [filters, sort, headerRightExtra],
  );

  useEffect(() => {
    onFiltersChange?.(filters);
  }, [filters]);

  useEffect(() => {
    const initFilters = async () => {
      if (route.params?.filtersOverride) {
        const { speciesName, ...filters } = route.params.filtersOverride;
        setFilters(filters);
        setFilterHints({ speciesName });
        navigation.setParams({ filtersOverride: undefined });
        setFiltersLoaded(true);
        return;
      }

      const {
        filters: deepFilters,
        sort: deepSort,
        hasParams,
      } = parseDeepLinkParams(route.params);

      if (hasParams) {
        setFilters(deepFilters);
        if (deepSort) setSort(deepSort);
      } else {
        const storedFilters = await loadFilters(screenName);
        const storedSort = await loadSort(screenName);
        setFilters(
          storedFilters ?? {
            territory: territory ?? profile.territory ?? null,
            date: date ?? null,
          },
        );
        const resolved = normalizeValue(
          storedSort,
          sortOptions.map((i) => i.value),
        );
        setSort(
          isDistanceSort(resolved) && permissionStatus === "denied"
            ? (sortOptions.find((o) => !isDistanceSort(o.value))?.value ??
                resolved)
            : resolved,
        );
      }
      setFiltersLoaded(true);
    };
    initFilters();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!filtersLoaded) return;

      const { placeId, territoryId } = route.params ?? {};

      setFilters((prev) => {
        if (!prev) return prev;

        let newFilters = { ...prev };
        let changed = false;

        const prevDate = JSON.stringify(prev.date ?? null);
        const contextDate = JSON.stringify(date ?? null);
        if (prevDate !== contextDate) {
          newFilters.date = date ?? null;
          changed = true;
        }

        const prevTerritory = prev.territory ?? null;
        const contextTerritory = territory ?? null;
        if (prevTerritory !== contextTerritory) {
          newFilters.territory = contextTerritory;
          newFilters.place = null;
          newFilters.species = null;
          changed = true;
        }

        if (placeId && territoryId) {
          newFilters = {
            ...newFilters,
            territory: territoryId,
            place: placeId,
            species: null,
          };
          changed = true;
        }

        if (!changed) return prev;
        saveFilters(screenName, newFilters);
        return newFilters;
      });

      if (placeId && territoryId) {
        navigation.setParams({ placeId: undefined, territoryId: undefined });
      }
    }, [date, territory, route.params?.placeId, filtersLoaded]),
  );

  useLayoutEffect(() => {
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
  if (isLoading || !data) return <LoadingOverlay />;

  return (
    <>
      {tabs}
      {showSearch && (
        <SearchInput
          value={search}
          onChange={setSearch}
          onClear={handleClearSearch}
          placeholder={t("search_by_name")}
        />
      )}
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
        screen={screenName}
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        filters={filters}
        allowed={allowedFilters}
        noSaveFilters={noSaveFilters}
        setFilters={handleFiltersApplied}
        clearFilters={handleClearFilters}
        extraTerritory={extraFilters?.territory}
      />
    </>
  );
};

export default ListScreen;
