import { StyleSheet, View, Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../store/theme-context";
import { formatDate } from "../../util/fetches";

const FilterChips = ({ filters, removeFilter }) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { t } = useTranslation();

  const formatFilterValue = (key, value) => {
    if (!value) return "";

    if (key === "date") {
      if (value.type === "range") {
        if (value.from && value.to)
          return `${formatDate(value.from)} – ${formatDate(value.to)}`;
        if (value.from) return `${t("from")} ${formatDate(value.from)}`;
        if (value.to) return `${t("to")} ${formatDate(value.to)}`;
      }
      if (value.type === "year" && value.year) {
        return value.year.toString();
      }
      return "";
    }

    if (key == "favourite") return value ? "yes" : "no";

    if (Array.isArray(value)) return value.join(", ");

    return value.toString();
  };

  return (
    <View style={styles.filtersContainer}>
      {Object.entries(filters).map(([key, value]) => {
        if (!value || (Array.isArray(value) && value.length === 0)) return null;

        const label =
          {
            territory: t("territory"),
            place: t("place"),
            date: t("date"),
            species: t("species"),
          }[key] || key;

        const displayValue = formatFilterValue(key, value);

        return (
          <View key={key} style={styles.filterChip}>
            <Text style={styles.filterText}>
              {label}: {displayValue}
            </Text>
            <Pressable
              onPress={() => removeFilter(key)}
              style={styles.removeIcon}
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
    </View>
  );
};

export default FilterChips;

const stylesFn = (Colors) =>
  StyleSheet.create({
    filtersContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginTop: 12,
      marginBottom: 4,
      paddingHorizontal: 12,
    },
    filterChip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: Colors.primary200,
      borderRadius: 16,
      paddingHorizontal: 8,
      paddingVertical: 6,
      marginRight: 4,
      borderWidth: 1,
      borderColor: Colors.accent,
    },
    filterText: {
      fontSize: 12,
      color: Colors.textMain,
      lineHeight: 16,
    },
    removeIcon: {
      marginLeft: 2,
      justifyContent: "center",
      alignItems: "center",
    },
  });
