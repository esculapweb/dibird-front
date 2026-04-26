import { StyleSheet, View } from "react-native";
import { useTheme, ThemeColors } from "../../store/theme-context";

const H_PAD = 16;

const StatsSkeleton = () => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <View style={styles.statsRow}>
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </View>
  );
};

export default StatsSkeleton;

// Одна карточка-заглушка
const StatCardSkeleton = () => {
  const { Colors } = useTheme();
  const styles = cardStylesFn(Colors);

  return (
    <View style={styles.statCard}>
      <View style={styles.statNumSkeleton} />
      <View style={styles.statLabelSkeleton} />
    </View>
  );
};

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    statsRow: {
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: H_PAD,
      paddingBottom: 12,
    },
  });

const cardStylesFn = (Colors) =>
  StyleSheet.create({
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
    statNumSkeleton: {
      width: 68,
      height: 26,
      backgroundColor: Colors.textMain,
      borderRadius: 8,
      marginBottom: 6,
      opacity: 0.2,
    },
    statLabelSkeleton: {
      width: 52,
      height: 13,
      backgroundColor: Colors.textMain,
      borderRadius: 4,
      opacity: 0.1,
    },
  });
