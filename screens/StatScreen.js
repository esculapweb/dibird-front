import { useState, useEffect } from "react";

import StatsTabs from "../navigation/StatsTabs";
import { loadDecorator, normalizeValue, fetchSeen } from "../util/fetches";
import { useLanguage } from "../store/language-context";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import FilterModal from "../components/Filters/FilterModal";
import SortModal from "../components/Sort/SortModal";
import { loadFilters, clearFilters } from "../util/filtersStorage";
import { loadSort } from "../util/sortStorage";
import IconButton from "../components/ui/IconButton";

const ALLOWED_SORT_FIELDS = ["ioc_id", "date_time", "name"];

const StatScreen = ({ navigation }) => {
  const [filters, setFilters] = useState(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sort, setSort] = useState(null);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [seen, setSeen] = useState([]);
  const [notSeen, setNotSeen] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const { language } = useLanguage();

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

  const emptyType = hasActiveFilters ? "filtered" : "initial";

  const handleClearFilters = async () => {
    setFilters({});
    await clearFilters();
    setFilterModalVisible(false);
  };

  const handleAddObservation = () => console.log("add observation");

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

export default StatScreen;
