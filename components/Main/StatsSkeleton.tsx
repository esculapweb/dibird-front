import { StyleSheet, View } from "react-native";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { Bone, SkeletonGroup } from "../ui/Skeleton";

const H_PAD = 16;
const CARDS = 4;

const StatsSkeleton = () => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <SkeletonGroup style={styles.statsRow}>
      {Array.from({ length: CARDS }).map((_, i) => (
        <View key={i} style={styles.statCard}>
          <Bone width={68} height={26} radius={8} style={styles.num} />
          <Bone width={52} height={13} radius={4} baseOpacity={0.7} />
        </View>
      ))}
    </SkeletonGroup>
  );
};

export default StatsSkeleton;

const stylesFn = (Colors: ThemeColors) =>
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
    // The bone is wider than a narrow card on small phones; let it shrink.
    num: { maxWidth: "100%", marginBottom: 6 },
  });
