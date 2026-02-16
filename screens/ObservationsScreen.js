import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";

import LoadingOverlay from "../components/ui/LoadingOverlay";
import FilterModal from "../components/Filters/FilterModal";
import SortModal from "../components/Sort/SortModal";
import { loadFilters, clearFilters, loadSort } from "../util/storageHelper";
import { normalizeValue } from "../util/fetches";
import SearchInput from "../components/ui/SearchInput";
import { useDebounce } from "../util/useDebounce";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import FiltersHeader from "../components/ui/FiltersHeader";
import { useObservations } from "../hooks/Observation/useObservations";

const ObservationsScreen = ({ route, navigation }) => {
  const { t } = useTranslation();

  const SORT_OPTIONS = [
    { label: t("date_sort_desc"), value: "-date_time" },
    { label: t("date_sort"), value: "date_time" },
    { label: t("taxonomic"), value: "ioc_id" },
    { label: t("taxonomic_desc"), value: "-ioc_id" },
    { label: t("alphabetic"), value: "name" },
    { label: t("alphabetic_desc"), value: "-name" },
  ];

  const ALLOWED_FILTERS = ["territory", "place", "date"]; //species

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
  } = useObservations({
    filters,
    sort,
    search: debouncedSearch,
  });
  const observations = data?.pages.flatMap((page) => page.results) ?? [];

  // console.log(observations)

  const isEmpty = observations.length === 0;
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

  const handleClearSearch = () => setSearch("");

  const handleClearFilters = async () => {
    setFilters({});
    await clearFilters(route.name);
    setFilterModalVisible(false);
  };

  const handleClearFiltersSearch = () => {
    handleClearSearch();
    handleClearFilters();
  };

  const handleFilterPress = () => setFilterModalVisible(true);
  const handleSortPress = () => setSortModalVisible(true);
  // const handleAddObservation = () => navigation.navigate("ObservationEditor");

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
      headerRight,
    });
  }, [navigation, headerRight]);

  if (isError)
    return (
      <ErrorOverlay
        title={t("observations_unavailable")}
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

      {/* <Observations
        data={observations}
        onEndReached={handleLoadMore}
        isLoadingMore={isFetchingNextPage}
        onAddObservation={handleAddObservation}
        emptyType={emptyType}
        onClear={handleClearFiltersSearch}
      /> */}

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

export default ObservationsScreen;
