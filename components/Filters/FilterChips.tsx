import { ScrollView, View, Pressable, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { useFilterLabels } from "../../hooks/useFilterLabels";
import { AllowedFilterKey, Filters, AllFiltersKey } from "../../types";

interface FilterChipsProps {
  filters: Filters;
  onRemove: (key: AllFiltersKey) => void;
  // A tap on the chip itself (the cross keeps removing it) reopens the filter
  // sheet on this very control. Optional: a screen without a filter sheet of
  // its own — the place page, which only shows the date chip — leaves it out
  // and the chips stay display-only.
  onEdit?: (key: AllFiltersKey) => void;
  extraFilters?: Filters | null;
  hints: {
    speciesName?: string;
  };
  allowed: AllowedFilterKey[];
}

const FilterChips = ({
  filters,
  onRemove,
  onEdit,
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

  // "unsynced" is answered from this device's local queue alone, with every
  // other filter ignored (see fetchObservations/fetchDiaries/fetchPlaces), so
  // while it is on it is the only chip there is. The other values stay in the
  // filters — removing this chip brings their rows straight back — they just
  // have nothing to say about what the list currently shows. The filter sheet
  // greys the matching controls out for the same reason. Gated on `allowed`
  // as well, so a screen that does not offer the filter at all (the map) can
  // never end up hiding every chip it has.
  const unsyncedOnly =
    !!filters.unsynced && (!allowed || allowed.includes("unsynced"));

  const activeFilters = (Object.entries(filters) as [AllFiltersKey, unknown][]).filter(
    ([key, value]) =>
      (!allowed || allowed.includes(key as AllowedFilterKey)) &&
      (!unsyncedOnly || key === "unsynced") &&
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
            <Pressable
              key={key}
              style={({ pressed }) => [
                styles.filterChip,
                pressed && !!onEdit && styles.filterChipPressed,
              ]}
              onPress={onEdit ? () => onEdit(key) : undefined}
              disabled={!onEdit}
              testID={`edit-filter-${key}`}
            >
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
            </Pressable>
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
    filterChipPressed: {
      opacity: 0.6,
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
