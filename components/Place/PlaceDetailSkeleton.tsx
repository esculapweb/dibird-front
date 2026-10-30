import { StyleSheet, View } from "react-native";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { Bone, SkeletonGroup } from "../ui/Skeleton";

const H_PAD = 12;
const MAP_HEIGHT = 410;

// PlaceDetailScreen: name and country, the map, then the three stat cards.
const PlaceDetailSkeleton = () => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <SkeletonGroup style={styles.root} testID="place-detail-skeleton">
      <View style={styles.header}>
        <Bone width="60%" height={20} />
        <Bone width="40%" height={14} radius={4} baseOpacity={0.7} style={styles.subtitle} />
      </View>

      <Bone height={MAP_HEIGHT} radius={0} />

      <View style={styles.statsRow}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.statCard}>
            <Bone width={40} height={24} radius={6} />
            <Bone width={56} height={12} radius={4} baseOpacity={0.7} />
          </View>
        ))}
      </View>
    </SkeletonGroup>
  );
};

export default PlaceDetailSkeleton;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, overflow: "hidden" },
    header: { padding: H_PAD },
    subtitle: { marginTop: 9, marginBottom: 5 },
    statsRow: { flexDirection: "row", gap: H_PAD, padding: H_PAD },
    statCard: {
      flex: 1,
      gap: 6,
      backgroundColor: Colors.primary100,
      borderRadius: 14,
      borderWidth: 0.5,
      borderColor: Colors.border,
      paddingVertical: 14,
      alignItems: "center",
    },
  });
