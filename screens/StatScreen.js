import { useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import StatsTabs from "../navigation/StatsTabs";
import { fetchSeen } from "../util/fetches";
import { useLanguage } from "../store/language-context";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import { Colors } from "../constants/styles";
import FilterModal from "../components/Filters/FilterModal";

const StatScreen = ({ navigation }) => {
  const [filters, setFilters] = useState({});
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [seen, setSeen] = useState([]);
  const [notSeen, setNotSeen] = useState([]);
  const { language } = useLanguage();

  const handleFilterPress = () => setFilterModalVisible(true);
  const hasActiveFilters = Object.values(filters).some(
    (v) => v !== null && v !== undefined && v !== ""
  );

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.filterContainer}>
          <Ionicons
            name={hasActiveFilters ? "options" : "options-outline"}
            size={22}
            color={Colors.primary100}
            onPress={handleFilterPress}
          />

          {hasActiveFilters && <View style={styles.dot} />}
        </View>
      ),
    });
  }, [navigation, filters]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const { seenList, notSeenList } = await fetchSeen(filters);
        setSeen(seenList);
        setNotSeen(notSeenList);
      } catch (e) {
        console.warn("Failed to load data", e.code, e.message);
      }
    };
    loadData();
  }, [language, filters]);

  if (!seen.length && !notSeen.length) return <LoadingOverlay />;

  return (
    <>
      <StatsTabs seen={seen} notSeen={notSeen} territory={filters?.territory} />
      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        filters={filters}
        setFilters={setFilters}
      />
    </>
  );
};

export default StatScreen;

const styles = StyleSheet.create({
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
    backgroundColor: Colors.accent,
  },
});
