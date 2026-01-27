import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import LoadingOverlay from "../components/ui/LoadingOverlay";
import IconButton from "../components/ui/IconButton";
import FilterModal from "../components/Filters/FilterModal";
import SortModal from "../components/Sort/SortModal";
import { loadFilters, clearFilters } from "../util/filtersStorage";
import { loadSort } from "../util/sortStorage";
import { fetchPlaces, loadDecorator, normalizeValue } from "../util/fetches";
import Places from "../components/Place/Places";
import SearchInput from "../components/ui/SearchInput";
import { useDebounce } from "../util/useDebounce";
import { useLanguage } from "../store/language-context";

const ALLOWED_SORT_FIELDS = ["name"];

const PlacesScreen = ({ navigation }) => {
  const { language } = useLanguage();
  const { t } = useTranslation();

  const [filters, setFilters] = useState(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sort, setSort] = useState(null);
  const [sortModalVisible, setSortModalVisible] = useState(false);

  const [places, setPlaces] = useState([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  const [page, setPage] = useState(1);
  const [finalPage, setFinalPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const handleFilterPress = () => setFilterModalVisible(true);
  const handleSortPress = () => setSortModalVisible(true);

  const hasActiveFilters = filters
    ? Object.values(filters).some((v) => {
        if (Array.isArray(v)) {
          return v.length > 0;
        }
        return v !== null && v !== undefined && v !== "";
      })
    : false;

  const handleClearFilters = async () => {
    setFilters({});
    await clearFilters();
    setFilterModalVisible(false);
  };

  const loadPlaces = async (pageNum = 1) => {
    if (pageNum > finalPage) return;

    pageNum === 1 ? setIsLoading(true) : setIsLoadingMore(true);

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
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && page < finalPage) {
      loadPlaces(page + 1);
    }
  };

  useEffect(() => {
    const initFilters = async () => {
      const storedFilters = await loadFilters();
      setFilters(storedFilters ?? {});
    };

    initFilters();
  }, []);

  useEffect(() => {
    const initSort = async () => {
      const storedSort = await loadSort();
      setSort(normalizeValue(storedSort, ALLOWED_SORT_FIELDS));
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
    if (!filters) return;
    loadDecorator(() => loadPlaces(1));
  }, [language, filters, sort, debouncedSearch]);

  if (isLoading || !filters || !sort) return <LoadingOverlay />;

  return (
    <>
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder={t("search_by_name")}
      />
      <Places
        data={places}
        onEndReached={handleLoadMore}
        isLoadingMore={isLoadingMore}
      />

      <SortModal
        visible={sortModalVisible}
        onClose={() => setSortModalVisible(false)}
        sort={sort}
        setSort={setSort}
      />
      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        filters={filters}
        setFilters={setFilters}
        clearFilters={handleClearFilters}
      />
    </>
  );
};

export default PlacesScreen;
