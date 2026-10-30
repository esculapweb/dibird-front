import { StyleSheet, View } from "react-native";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { Bone, SectionSkeleton, SkeletonGroup } from "../ui/Skeleton";

const IMAGE_SIZE = 90;

// The observation card of ObservationDetailScreen / CommunityDetailScreen:
// species photo and names, the place line and the map at the card's foot.
const ObservationDetailSkeleton = ({
  mapHeight = 250,
}: {
  mapHeight?: number;
}) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <SkeletonGroup style={styles.root} testID="observation-detail-skeleton">
      <SectionSkeleton>
        <View style={styles.header}>
          <Bone width={IMAGE_SIZE} height={IMAGE_SIZE} radius={12} />
          <View style={styles.names}>
            <Bone width="75%" height={22} />
            <Bone width="55%" height={14} radius={4} baseOpacity={0.7} />
            <Bone width={70} height={22} radius={11} style={styles.capsule} />
          </View>
        </View>

        <View style={styles.divider}>
          <Bone width="35%" height={11} radius={4} baseOpacity={0.7} />
          <Bone width="65%" height={15} radius={4} />
        </View>

        <View style={styles.map}>
          <Bone height={mapHeight} radius={0} />
        </View>
      </SectionSkeleton>

      <SectionSkeleton lines={2} />
    </SkeletonGroup>
  );
};

export default ObservationDetailSkeleton;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, padding: 12, overflow: "hidden" },
    header: { flexDirection: "row", alignItems: "center", gap: 16 },
    names: { flex: 1, gap: 6 },
    capsule: { marginTop: 2 },
    divider: {
      gap: 6,
      marginTop: 12,
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
    },
    // Bleeds to the card's edges like the real map does.
    map: {
      marginHorizontal: -16,
      marginBottom: -16,
      borderBottomLeftRadius: 14,
      borderBottomRightRadius: 14,
      overflow: "hidden",
    },
  });
