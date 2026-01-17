import { useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import StatsTabs from "../navigation/StatsTabs";
import { loadDecorator, fetchSeen } from "../util/fetches";
import { useLanguage } from "../store/language-context";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import { Colors } from "../constants/styles";
import FilterModal from "../components/Filters/FilterModal";

const StatScreen = ({ navigation }) => {
  const [filters, setFilters] = useState({});
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [seen, setSeen] = useState([]);
  const [notSeen, setNotSeen] = useState([]);
  const [isLoading, setIsLoading] = useState(true); // добавляем

  const { language } = useLanguage();

  const handleFilterPress = () => setFilterModalVisible(true);

  const hasActiveFilters = Object.values(filters).some((v) => {
    if (Array.isArray(v)) {
      return v.length > 0;
    }
    return v !== null && v !== undefined && v !== "";
  });

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


  if (isLoading) return <LoadingOverlay />;

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
    backgroundColor: Colors.error500,
  },
});
