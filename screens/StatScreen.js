import { useState, useEffect } from "react";

import StatsTabs from "../navigation/StatsTabs";
import { loadDecorator, fetchSeen } from "../util/fetches";
import { useLanguage } from "../store/language-context";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import FilterModal from "../components/Filters/FilterModal";
import { loadFilters, clearFilters } from "../util/filtersStorage";
import IconButton from "../components/ui/IconButton";

const StatScreen = ({ navigation }) => {
  const [filters, setFilters] = useState(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [seen, setSeen] = useState([]);
  const [notSeen, setNotSeen] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const { language } = useLanguage();

  const handleFilterPress = () => setFilterModalVisible(true);

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

  useEffect(() => {
    const initFilters = async () => {
      const storedFilters = await loadFilters();
      setFilters(storedFilters ?? {});
    };

    initFilters();
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerRight: ({ tintColor }) => (
        <>
          <IconButton
            tintColor={tintColor}
            onPress={()=>{}}
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
  }, [navigation, filters]);

  useEffect(() => {
    if (!filters) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const { seenList, notSeenList } = await fetchSeen(filters);
        setSeen(seenList);
        setNotSeen(notSeenList);
      } finally {
        setIsLoading(false);
      }
    };
    loadDecorator(loadData);
  }, [language, filters]);

  if (isLoading || !filters) return <LoadingOverlay />;

  return (
    <>
      <StatsTabs seen={seen} notSeen={notSeen} territory={filters?.territory} />
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
