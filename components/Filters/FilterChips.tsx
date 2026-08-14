import { ScrollView, View, Pressable, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { useFilterLabels } from "../../hooks/useFilterLabels";
import { AllowedFilterKey, Filters, AllFiltersKey } from "../../types";

interface FilterChipsProps {
  filters: Filters;
  onRemove: (key: AllFiltersKey) => void;
  extraFilters?: Filters | null;
  hints: {
    speciesName?: string;
  };
  allowed: AllowedFilterKey[];
}

const FilterChips = ({
  filters,
  onRemove,
  extraFilters,
  hints,
  allowed,
}: FilterChipsProps) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const effectiveTerritory =
    filters?.territory ?? extraFilters?.territory ?? null;
  const { getFilterLabel } = useFilterLabels(effectiveTerritory, hints);

  // After the hooks, never before them: bailing out first made the number of
  // hooks depend on a prop, so a mounted chip row handed a null `filters`
  // would crash React on the hook-order mismatch rather than just render
  // nothing.
  if (!filters || typeof filters !== "object") return null;

  const activeFilters = (Object.entries(filters) as [AllFiltersKey, unknown][]).filter(
    ([key, value]) =>
      (!allowed || allowed.includes(key as AllowedFilterKey)) &&
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
                <Text style={styles.filterLabel}>{filterName}: </Text>
                <Text style={styles.filterValue}>{filterLabel}</Text>
              </Text>
              <View style={styles.removeIcon}>
                <Pressable
                  onPress={() => onRemove(key)}
                  hitSlop={8}
                  testID={`remove-filter-${key}`}
                >
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

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: {
      paddingTop: 10,
      paddingBottom: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
    },
    scrollContainer: {
      paddingHorizontal: 10,
      alignItems: "center",
    },
    filterChip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: Colors.primary100,
      borderRadius: 16,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginRight: 8,
      borderWidth: 1,
      borderColor: Colors.border,
      maxWidth: 300,
    },
    filterText: {
      fontSize: 12,
      lineHeight: 16,
      flexShrink: 1,
      marginRight: 4,
    },
    filterLabel: {
      fontSize: 11,
      color: Colors.textSecondary,
      fontWeight: "400",
    },
    filterValue: {
      fontSize: 12,
      color: Colors.textMain,
      fontWeight: "600",
    },
    removeIcon: {
      marginLeft: 4,
      justifyContent: "center",
      alignItems: "center",
    },
  });
