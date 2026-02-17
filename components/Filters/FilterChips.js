import { ScrollView, View, Pressable, Text, StyleSheet } from "react-native";
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
      if (value.type === "year" && value.year) return value.year.toString();
      return "";
    }

    if (key === "favourite") return value ? t("yes") : t("no");
    if (Array.isArray(value)) return value.join(", ");

    return value.toString();
  };

  const filterEntries = Object.entries(filters).filter(
    ([_, value]) => value && (!Array.isArray(value) || value.length > 0),
  );

  if (filterEntries.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {filterEntries.map(([key, value]) => {
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
    },
    filterText: {
      fontSize: 12,
      color: Colors.textMain,
      lineHeight: 16,
    },
    removeIcon: {
      marginLeft: 4,
      justifyContent: "center",
      alignItems: "center",
    },
  });
