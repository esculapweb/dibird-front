import { StyleSheet, View } from "react-native";

import { useTheme, ThemeColors } from "../../../store/theme-context";
import { Bone } from "./Skeleton";

export interface ListRowSkeletonProps {
  thumb?: "square" | "circle" | "none";
  thumbSize?: number;
  lines?: 1 | 2 | 3;
}

// Mirrors the shared card geometry of the list rows (ObservationCard,
// DiaryCard, PlaceCard, TerritoryRow, NotificationCard…): primary100
// background, radius 12, 4px apart — so the list doesn't shift when the real
// rows replace it.
const ListRowSkeleton = ({
  thumb = "square",
  thumbSize = 48,
  lines = 2,
}: ListRowSkeletonProps) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <View style={styles.card}>
      {thumb !== "none" && (
        <Bone
          height={thumbSize}
          width={thumbSize}
          circle={thumb === "circle"}
          radius={10}
        />
      )}
      <View style={styles.text}>
        <Bone height={15} width="65%" radius={4} />
        {lines > 1 && <Bone height={12} width="45%" radius={4} baseOpacity={0.7} />}
        {lines > 2 && <Bone height={12} width="30%" radius={4} baseOpacity={0.7} />}
      </View>
    </View>
  );
};

export default ListRowSkeleton;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: Colors.primary100,
      borderRadius: 12,
      padding: 10,
      marginBottom: 4,
    },
    text: { flex: 1, gap: 6 },
  });
