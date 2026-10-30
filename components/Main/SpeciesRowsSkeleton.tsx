import { StyleSheet, View } from "react-native";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { Bone, SkeletonGroup } from "../ui/Skeleton";

const H_PAD = 16;
const ROWS = 3;

// The loading state of the dashboard's species lists (NewSpecies,
// RareNearby): same card, row padding and dividers as the real rows.
const SpeciesRowsSkeleton = ({ imageSize }: { imageSize: number }) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <SkeletonGroup style={styles.list}>
      {Array.from({ length: ROWS }).map((_, i) => (
        <View key={i} style={[styles.row, i < ROWS - 1 && styles.divider]}>
          <Bone width={imageSize} height={imageSize} radius={12} />
          <View style={styles.names}>
            <Bone height={15} width="60%" radius={4} />
            <Bone height={13} width="40%" radius={4} baseOpacity={0.7} />
          </View>
          <Bone height={13} width={40} radius={4} />
        </View>
      ))}
    </SkeletonGroup>
  );
};

export default SpeciesRowsSkeleton;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    list: {
      marginHorizontal: H_PAD,
      borderRadius: 14,
      overflow: "hidden",
      marginBottom: 12,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: Colors.primary100,
    },
    divider: {
      borderBottomWidth: 0.5,
      borderBottomColor: Colors.divider,
    },
    names: { flex: 1, gap: 6 },
  });
