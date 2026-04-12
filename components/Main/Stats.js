import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";

import { useTheme } from "../../store/theme-context";

const H_PAD = 16;

const StatCard = ({ value, label, onPress }) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  return (
    <TouchableOpacity onPress={onPress} style={styles.statCard}>
      <Text style={styles.statNum}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
};

const Stats = ({ data, filters }) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const navigation = useNavigation();

  return (
    <View style={styles.statsRow}>
      <StatCard
        value={data.species}
        label={t("species")}
        onPress={() =>
          navigation.navigate("Stat", {
            filtersOverride: {
              ...filters,
            },
            seenMode: "seen",
            o: "-seen,-date_time",
          })
        }
      />
      <StatCard
        value={data.observations}
        label={t("observations")}
        onPress={() => navigation.navigate("Observations")}
      />
      <StatCard
        value={data.diaries}
        label={t("diaries")}
        onPress={() => navigation.navigate("Diaries")}
      />
      <StatCard
        value={`#${data.rank}`}
        label={t("rating")}
        onPress={() => navigation.navigate("Rating")}
      />
    </View>
  );
};

export default Stats;

const stylesFn = (Colors) =>
  StyleSheet.create({
    statsRow: {
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: H_PAD,
      paddingBottom: 12,
    },
    statCard: {
      flex: 1,
      backgroundColor: Colors.primary100,
      borderRadius: 14,
      borderWidth: 0.5,
      borderColor: Colors.border,
      paddingVertical: 14,
      paddingHorizontal: 4,
      alignItems: "center",
    },
    statNum: { fontSize: 22, fontWeight: "600", color: Colors.textMain },
    statLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 3 },
  });
