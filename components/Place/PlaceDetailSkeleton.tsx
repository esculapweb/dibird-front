import { StyleSheet, View } from "react-native";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { Bone, SkeletonGroup } from "../ui/Skeleton";

const H_PAD = 12;

// PlaceDetailScreen (MapSheetLayout): the map under the whole screen, and the
// sheet at its resting height — name and country, then the three stat cards.
const PlaceDetailSkeleton = () => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <SkeletonGroup style={styles.root} testID="place-detail-skeleton">
      <Bone height="100%" radius={0} style={StyleSheet.absoluteFill} />

      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Bone width="60%" height={20} />
          <Bone width="40%" height={14} radius={4} baseOpacity={0.7} style={styles.subtitle} />
        </View>

        <View style={styles.statsRow}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.statCard}>
              <Bone width={40} height={24} radius={6} />
              <Bone width={56} height={12} radius={4} baseOpacity={0.7} />
            </View>
          ))}
        </View>
      </View>
    </SkeletonGroup>
  );
};

export default PlaceDetailSkeleton;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, overflow: "hidden", backgroundColor: Colors.primary100 },
    sheet: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: "40%",
      backgroundColor: Colors.primary100,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    handle: {
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: 2,
      marginVertical: 10,
      backgroundColor: Colors.textSecondary,
    },
    header: { paddingHorizontal: H_PAD, paddingBottom: H_PAD },
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
