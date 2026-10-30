import { View, StyleSheet } from "react-native";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { Bone, SkeletonGroup } from "../ui/Skeleton";

const H_PAD = 16;
const SPARK_H = 52;
const BAR_COUNT = 20;

// A fixed wave so the placeholder reads as a chart, not a row of equal bars.
const BAR_HEIGHTS = Array.from({ length: BAR_COUNT }, (_, i) =>
  Math.abs(22 + Math.sin(i * 0.8) * 18),
);

export const SparklineSkeleton = () => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <SkeletonGroup style={styles.card}>
      <View style={styles.head}>
        <Bone width={120} height={13} />
        <Bone width={80} height={13} />
      </View>

      <View style={styles.bars}>
        {BAR_HEIGHTS.map((h, i) => (
          <Bone
            key={i}
            height={h}
            radius={3}
            baseOpacity={0.5 + (i / BAR_COUNT) * 0.5}
            style={styles.bar}
          />
        ))}
      </View>
    </SkeletonGroup>
  );
};

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      marginHorizontal: H_PAD,
      marginBottom: 12,
      borderRadius: 14,
      borderWidth: 0.5,
      padding: 16,
      backgroundColor: Colors.primary100,
      borderColor: Colors.border,
    },
    head: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    bars: {
      flexDirection: "row",
      alignItems: "flex-end",
      height: SPARK_H,
      gap: 2,
    },
    bar: { flex: 1, width: undefined },
  });
