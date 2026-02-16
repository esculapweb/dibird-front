import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";

import StatsTabs from "../navigation/StatsTabs";
import { loadDecorator, normalizeValue, fetchSeen } from "../util/fetches";
import { useLanguage } from "../store/language-context";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import FilterModal from "../components/Filters/FilterModal";
import SortModal from "../components/Sort/SortModal";
import { loadFilters, clearFilters, loadSort } from "../util/storageHelper";
import FiltersHeader from "../components/ui/FiltersHeader";

const StatScreen = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { language } = useLanguage();

  const [filters, setFilters] = useState(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sort, setSort] = useState(null);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [seen, setSeen] = useState([]);
  const [notSeen, setNotSeen] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const handleFilterPress = () => setFilterModalVisible(true);
  const handleSortPress = () => setSortModalVisible(true);

  const SORT_OPTIONS = [
    { label: t("taxonomic"), value: "ioc_id" },
    { label: t("taxonomic_desc"), value: "-ioc_id" },
    { label: t("alphabetic"), value: "name" },
    { label: t("alphabetic_desc"), value: "-name" },
    { label: t("date_sort_desc"), value: "-date_time" },
    { label: t("date_sort"), value: "date_time" },
  ];

  const ALLOWED_FILTERS = ["territory", "place", "date"];

  const hasActiveFilters = filters
    ? Object.values(filters).some((v) =>
        Array.isArray(v) ? v.length > 0 : v != null && v !== "",
      )
    : false;

  const emptyType = hasActiveFilters ? "filtered" : "initial";

  const handleClearFilters = async () => {
    setFilters({});
    await clearFilters(route.name);
    setFilterModalVisible(false);
  };

  const handleAddObservation = () => console.log("add observation");

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

  useEffect(() => {
    if (!filters) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const { seenList, notSeenList } = await fetchSeen(filters, sort);
        setSeen(seenList);
        setNotSeen(notSeenList);
      } finally {
        setIsLoading(false);
      }
    };
    loadDecorator(loadData);
  }, [language, filters, sort]);

  if (isLoading || !filters || !sort) return <LoadingOverlay />;

  return (
    <>
      <StatsTabs
        seen={seen}
        notSeen={notSeen}
        onAdd={handleAddObservation}
        emptyType={emptyType}
        onClear={handleClearFilters}
        territory={filters?.territory}
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

export default StatScreen;
