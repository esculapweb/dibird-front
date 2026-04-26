import { StyleSheet, View } from "react-native";
import { useTheme, ThemeColors } from "../../store/theme-context";

const H_PAD = 16;

const ChecklistHeroSkeleton = () => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <View style={styles.clCard}>
      <View style={styles.clTagSkeleton} />

      <View style={styles.clRow}>
        <View style={styles.clNumRow}>
          <View style={styles.clNumSkeleton} />
          <View style={styles.clOfSkeleton} />
        </View>
      </View>

      <View style={styles.clBarBg}></View>
    </View>
  );
};

export default ChecklistHeroSkeleton;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    clCard: {
      marginHorizontal: H_PAD,
      marginBottom: 12,
      backgroundColor: Colors.main100,
      borderRadius: 14,
      padding: 18,
    },

    clTagSkeleton: {
      width: "68%",
      height: 16,
      backgroundColor: Colors.primary100,
      borderRadius: 6,
      marginBottom: 12,
      opacity: 0.2,
    },

    clRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
    },

    clNumRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 8,
    },

    // Большое число (seen)
    clNumSkeleton: {
      width: 92,
      height: 42,
      backgroundColor: Colors.primary100,
      borderRadius: 10,
      opacity: 0.2,
    },

    // "of XXXX"
    clOfSkeleton: {
      width: 78,
      height: 18,
      backgroundColor: Colors.primary100,
      borderRadius: 6,
      marginBottom: 4,
      opacity: 0.2,
    },

    // Прогресс бар
    clBarBg: {
      marginTop: 16,
      height: 5,
      borderRadius: 3,
      overflow: "hidden",
      backgroundColor: Colors.mainProgressBg,
    },

  });
