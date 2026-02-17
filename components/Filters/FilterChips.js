import { ScrollView, View, Pressable, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../store/theme-context";
import { useFilterLabels } from "../../hooks/useFilterLabels";

const FilterChips = ({ filters, onRemove }) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { t } = useTranslation();
  const { getFilterLabel } = useFilterLabels(filters);

  const activeFilters = Object.entries(filters).filter(
    ([, value]) =>
      value !== null &&
      value !== undefined &&
      !(Array.isArray(value) && value.length === 0),
  );

  if (activeFilters.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {activeFilters.map(([key, value]) => {
          const [filterName, filterLabel] = getFilterLabel(key, value);
          return (
            <View key={key} style={styles.filterChip}>
              <Text
                style={styles.filterText}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {filterName}: {filterLabel}
              </Text>
              <Pressable
                onPress={() => onRemove(key)}
                style={styles.removeIcon}
                hitSlop={8}
              >
                <Ionicons
                  name="close-circle"
                  size={16}
                  color={Colors.textSecondary}
                />
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

export default FilterChips;

const stylesFn = (Colors) =>
  StyleSheet.create({
    wrapper: {
      paddingTop: 12,
      paddingBottom: 4,
    },
    scrollContainer: {
      paddingHorizontal: 12,
      alignItems: "center",
    },
    filterChip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: Colors.primary200,
      borderRadius: 16,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginRight: 8,
      borderWidth: 1,
      borderColor: Colors.accent,
      maxWidth: 300,
    },
    filterText: {
      fontSize: 12,
      color: Colors.textMain,
      lineHeight: 16,
      flexShrink: 1, 
      marginRight: 4,

    },
    removeIcon: {
      marginLeft: 4,
      justifyContent: "center",
      alignItems: "center",
    },
  });
