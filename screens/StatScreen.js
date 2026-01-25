import { useState, useEffect } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import StatsTabs from "../navigation/StatsTabs";
import { loadDecorator, fetchSeen } from "../util/fetches";
import { useLanguage } from "../store/language-context";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import FilterModal from "../components/Filters/FilterModal";
import { loadFilters, clearFilters } from "../util/filtersStorage";
import { useTheme } from "../store/theme-context";

const StatScreen = ({ navigation }) => {
  const [filters, setFilters] = useState(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [seen, setSeen] = useState([]);
  const [notSeen, setNotSeen] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const { language } = useLanguage();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

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
      headerRight: () => (
        <Pressable
          style={({ pressed }) => [
            styles.filterContainer,
            pressed && styles.pressed,
          ]}
          onPress={handleFilterPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={hasActiveFilters ? "options" : "options-outline"}
            size={22}
            color={Colors.primary100}
          />

          {hasActiveFilters && <View style={styles.dot} />}
        </Pressable>
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

const stylesFn = (Colors) =>
  StyleSheet.create({
    filterContainer: {
      marginRight: 16,
    },
    dot: {
      position: "absolute",
      top: -2,
      right: -2,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: Colors.logoAccent,
      borderWidth: 1,
      borderColor: Colors.primary100,
    },
    pressed: {
      opacity: 0.7,
    },
  });
