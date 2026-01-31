import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import LoadingOverlay from "../components/ui/LoadingOverlay";
import IconButton from "../components/ui/IconButton";
import FilterModal from "../components/Filters/FilterModal";
import SortModal from "../components/Sort/SortModal";
import { loadFilters, clearFilters, loadSort } from "../util/storageHelper";
import { fetchPlaces, loadDecorator, normalizeValue } from "../util/fetches";
import Places from "../components/Place/Places";
import SearchInput from "../components/ui/SearchInput";
import { useDebounce } from "../util/useDebounce";
import { useLanguage } from "../store/language-context";

const PlacesScreen = ({ route, navigation }) => {
  const { language } = useLanguage();
  const { t } = useTranslation();

  const SORT_OPTIONS = [
    { label: t("alphabetic"), value: "name" },
    { label: t("alphabetic_desc"), value: "-name" },
    // { label: t("favourite_asc"), value: "favourite,name" },
    // { label: t("favourite_desc"), value: "-favourite,name" },
    // { label: t("territory_asc"), value: "territory,name" },
    // { label: t("territory_desc"), value: "-territory,name" },
    { label: t("species_count"), value: "species_count" },
    { label: t("species_count_desc"), value: "-species_count" },
    { label: t("observation_count"), value: "observation_count" },
    { label: t("observation_count_desc"), value: "-observation_count" },
    // { label: t("diary_count"), value: "diary_count" },
    // { label: t("diary_count_desc"), value: "-diary_count" },
  ];

  const ALLOWED_FILTERS = ['territory', 'favourite']

  const [filters, setFilters] = useState(null);
  const [sort, setSort] = useState(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);

  const [places, setPlaces] = useState([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  const [page, setPage] = useState(1);
  const [finalPage, setFinalPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const hasActiveFilters = filters
    ? Object.values(filters).some((v) =>
        Array.isArray(v) ? v.length > 0 : v != null && v !== "",
      )
    : false;

  const isEmpty = places.length === 0;
  const isSearchActive = debouncedSearch.length > 0;

  const emptyType =
    !isInitialLoad && isEmpty
      ? isSearchActive || hasActiveFilters
        ? "filtered"
        : "initial"
      : null;

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
  const handleAddPlace = () => console.log("Add place");

  const loadPlaces = async (pageNum = 1) => {
    if (pageNum > finalPage) return;

    pageNum === 1 ? null : setIsLoadingMore(true);

    try {
      const response = await fetchPlaces(
        filters,
        sort,
        debouncedSearch,
        pageNum,
      );
      const { results, pagination } = response;

      setPlaces((prev) => (pageNum === 1 ? results : [...prev, ...results]));
      setPage(pagination.current);
      setFinalPage(pagination.final);
    } finally {
      setIsLoadingMore(false);
      if (isInitialLoad) setIsInitialLoad(false);
    }
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && page < finalPage) {
      loadPlaces(page + 1);
    }
  };

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

  useEffect(() => {
    if (!filters || !sort) return;
    loadDecorator(() => loadPlaces(1));
  }, [language, filters, sort, debouncedSearch]);

  if (isInitialLoad || !filters || !sort) return <LoadingOverlay />;

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
        isLoadingMore={isLoadingMore}
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
