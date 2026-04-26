import { View, StyleSheet } from "react-native";
import { useTheme, ThemeColors } from "../../store/theme-context";

const H_PAD = 16;
const SPARK_H = 52;
const BAR_COUNT = 20;

export const SparklineSkeleton = () => {
  const { Colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: Colors.primary100, borderColor: Colors.border }]}>
      <View style={styles.head}>
        <View style={[styles.pill, { width: 120, backgroundColor: Colors.border }]} />
        <View style={[styles.pill, { width: 80, backgroundColor: Colors.border }]} />
      </View>

      {/* бары */}
      <View style={styles.bars}>
        {Array.from({ length: BAR_COUNT }).map((_, i) => {
          const h = 8 + Math.sin(i * 0.8) * 18 + 14; 
          return (
            <View
              key={i}
              style={{
                flex: 1,
                height: Math.abs(h),
                borderRadius: 3,
                backgroundColor: Colors.border,
                opacity: 0.5 + (i / BAR_COUNT) * 0.5,
              }}
            />
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: H_PAD,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 0.5,
    padding: 16,
  },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  pill: {
    height: 13,
    borderRadius: 6,
  },
  bars: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: SPARK_H,
    gap: 2,
  },
});