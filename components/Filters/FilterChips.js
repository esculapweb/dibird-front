import { ScrollView, View, Pressable, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../store/theme-context";
import { useFilterLabels } from "../../hooks/useFilterLabels";

const FilterChips = ({ filters, onRemove }) => {
  if (!filters || typeof filters !== "object") return null;

  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
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
              <View style={styles.removeIcon}>
                <Pressable onPress={() => onRemove(key)} hitSlop={8}>
                  <Ionicons
                    name="close-circle"
                    size={16}
                    color={Colors.textSecondary}
                  />
                </Pressable>
              </View>
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
      paddingTop: 10,
      paddingBottom: 8,
      // backgroundColor: Colors.primary100,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
    },
    scrollContainer: {
      paddingHorizontal: 10,
      alignItems: "center",
      // justifyContent: "center",
      // flexGrow: 1,
    },
    filterChip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: Colors.primary200,
      borderRadius: 16,
      paddingHorizontal: 10,
      paddingVertical: 8,
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
