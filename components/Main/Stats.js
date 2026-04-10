import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../store/theme-context";

const H_PAD = 16;

const StatCard = ({ value, label }) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  return (
    <View style={styles.statCard}>
      <Text style={styles.statNum}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
};

const Stats = ({ data }) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  return (
    <View style={styles.statsRow}>
      <StatCard value={data.species} label={t("species")} />
      <StatCard value={data.observations} label={t("observations")} />
      <StatCard value={data.diaries} label={t("diaries")} />
      <StatCard value={`#${data.rank}`} label={t("rating")} />
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
