import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { fetchSpeciesCount } from "../../util/fetches";
import { StaleTime } from "../../constants/staleTime";
import { AppStackNavigationProp } from "../../types";

const H_PAD = 16;

// The catalogue used to be one of seven identical tiles at the very bottom,
// among sections that are all about the user's own data. It is the app's
// reference half — and now carries search, trait filters and comparison —
// so it gets a block of its own, right after the bird of the day (which is
// catalogue content too).
const CatalogCard = () => {
  const navigation = useNavigation<AppStackNavigationProp>();
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  const { data: speciesCount } = useQuery({
    queryKey: ["SpeciesCount"],
    queryFn: fetchSpeciesCount,
    staleTime: StaleTime.ONE_DAY,
  });

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      // Straight to the birds. The order tree is a step for someone who
      // already knows the taxonomy — it isn't a place to land a newcomer.
      onPress={() =>
        navigation.navigate("Taxonomy", {
          rank: 5,
          title: t("species_catalog"),
        })
      }
      testID="catalog-card"
    >
      <View style={styles.header}>
        <Ionicons name="book" size={22} color={Colors.main100} />
        <View style={styles.titles}>
          <Text style={styles.title}>{t("species_catalog")}</Text>
          {speciesCount != null && (
            <Text style={styles.subtitle}>
              {t("species_catalog_count", {
                count: speciesCount,
              })}
            </Text>
          )}
        </View>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={Colors.textSecondary}
        />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.action}
          onPress={() => navigation.navigate("Taxonomy", { rank: 2 })}
          testID="catalog-card-groups"
        >
          <Ionicons name="git-branch" size={16} color={Colors.main100} />
          <Text style={styles.actionText}>{t("groups")}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.action}
          onPress={() => navigation.navigate("SpeciesCompare", undefined)}
          testID="catalog-card-compare"
        >
          <Ionicons name="git-compare" size={16} color={Colors.main100} />
          <Text style={styles.actionText}>{t("compare_species")}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

export default CatalogCard;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      marginHorizontal: H_PAD,
      marginBottom: 12,
      padding: 14,
      borderRadius: 14,
      backgroundColor: Colors.primary100,
    },
    header: { flexDirection: "row", alignItems: "center", gap: 10 },
    titles: { flex: 1 },
    title: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors.textMain,
    },
    subtitle: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginTop: 1,
    },
    actions: { flexDirection: "row", gap: 8, marginTop: 12 },
    action: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: Colors.main300,
    },
    actionText: {
      fontSize: 13,
      fontWeight: "600",
      color: Colors.main100,
    },
  });
