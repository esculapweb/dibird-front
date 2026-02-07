import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import LoadingOverlay from "../components/ui/LoadingOverlay";
import IconButton from "../components/ui/IconButton";
import FilterModal from "../components/Filters/FilterModal";
import SortModal from "../components/Sort/SortModal";
import { loadFilters, clearFilters, loadSort } from "../util/storageHelper";
import { normalizeValue } from "../util/fetches";
import Places from "../components/Place/Places";
import SearchInput from "../components/ui/SearchInput";
import { useDebounce } from "../util/useDebounce";
import { usePlaces } from "../hooks/usePlaces";
import ErrorOverlay from "../components/Error/ErrorOverlay";

const PlacesScreen = ({ route, navigation }) => {
  const { t } = useTranslation();

  const SORT_OPTIONS = [
    { label: t("alphabetic"), value: "name" },
    { label: t("alphabetic_desc"), value: "-name" },
    // { label: t("favourite_asc"), value: "favourite,name" },
    // { label: t("favourite_desc"), value: "-favourite,name" },
    // { label: t("territory_asc"), value: "territory,name" },
    // { label: t("territory_desc"), value: "-territory,name" },
    { label: t("species_count"), value: "species_count,name" },
    { label: t("species_count_desc"), value: "-species_count,name" },
    { label: t("observation_count"), value: "observation_count,name" },
    { label: t("observation_count_desc"), value: "-observation_count, name" },
    // { label: t("diary_count"), value: "diary_count" },
    // { label: t("diary_count_desc"), value: "-diary_count" },
  ];

  const ALLOWED_FILTERS = ["territory", "favourite"];

  const [filters, setFilters] = useState(null);
  const [sort, setSort] = useState(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  const hasActiveFilters = filters
    ? Object.values(filters).some((v) =>
        Array.isArray(v) ? v.length > 0 : v != null && v !== "",
      )
    : false;

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = usePlaces({
    filters,
    sort,
    search: debouncedSearch,
  });
  const places = data?.pages.flatMap((page) => page.results) ?? [];

  const isEmpty = places.length === 0;
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
    await clearFilters(route.name);
    setFilterModalVisible(false);
  };

  const handleClearSearch = () => setSearch("");

  const handleClearFiltersSearch = () => {
    handleClearSearch();
    handleClearFilters();
  };

  const handleFilterPress = () => setFilterModalVisible(true);
  const handleSortPress = () => setSortModalVisible(true);
  const handleAddPlace = () => navigation.navigate("AddPlace");

  useEffect(() => {
    const initFilters = async () => {
      const storedFilters = await loadFilters(route.name);
      setFilters(storedFilters ?? {});
    };
    initFilters();
  }, []);

  useEffect(() => {
    const initSort = async () => {
      const storedSort = await loadSort(route.name);
      setSort(
        normalizeValue(
          storedSort,
          SORT_OPTIONS.map((item) => item.value),
        ),
      );
    };
    initSort();
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerRight: ({ tintColor }) => (
        <>
          <IconButton
            tintColor={tintColor}
            onPress={handleSortPress}
            icon="swap-vertical"
          />
          <IconButton
            tintColor={tintColor}
            onPress={handleFilterPress}
            icon={hasActiveFilters ? "options" : "options-outline"}
            active={hasActiveFilters}
          />
        </>
      ),
    });
  }, [navigation, filters, sort]);

  if (isError)
    return (
      <ErrorOverlay
        title={t("places_unavailable")}
        message={error.message}
        onPress={refetch}
        logo
      />
    );
  if (isLoading || !filters || !sort) return <LoadingOverlay />;

  return (
    <>
      <SearchInput
        value={search}
        onChange={setSearch}
        onClear={handleClearSearch}
        placeholder={t("search_by_name")}
      />

      <Places
        data={places}
        onEndReached={handleLoadMore}
        isLoadingMore={isFetchingNextPage}
        onAddPlace={handleAddPlace}
        emptyType={emptyType}
        onClear={handleClearFiltersSearch}
      />

      <SortModal
        screen={route.name}
        options={SORT_OPTIONS}
        visible={sortModalVisible}
        onClose={() => setSortModalVisible(false)}
        sort={sort}
        setSort={setSort}
      />
      <FilterModal
        screen={route.name}
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        filters={filters}
        allowed={ALLOWED_FILTERS}
        setFilters={setFilters}
        clearFilters={handleClearFilters}
      />
    </>
  );
};

export default PlacesScreen;
