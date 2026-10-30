import { StyleSheet, View } from "react-native";

import { GRID_GAP } from "../ItemsList";
import { Bone, SkeletonGroup } from "./Skeleton";
import ListRowSkeleton, { ListRowSkeletonProps } from "./ListRowSkeleton";

interface ListSkeletonProps extends ListRowSkeletonProps {
  count?: number;
  // Same meaning as ItemsList's numColumns: > 1 draws square tiles.
  numColumns?: number;
  testID?: string;
  // Off when the skeleton sits inside an already padded list (a list header).
  padded?: boolean;
}

// Stand-in for ItemsList while its first page loads. Uses ItemsList's
// padding and grid gaps so the swap to real content doesn't jump.
const ListSkeleton = ({
  count,
  numColumns = 1,
  testID = "list-skeleton",
  padded = true,
  ...row
}: ListSkeletonProps) => {
  const isGrid = numColumns > 1;
  const items = Array.from({ length: count ?? (isGrid ? numColumns * 4 : 8) });

  return (
    <SkeletonGroup style={padded ? styles.list : null} testID={testID}>
      {isGrid ? (
        <View style={styles.grid}>
          {items.map((_, i) => (
            <View
              key={i}
              testID="list-skeleton-tile"
              style={[styles.cell, { width: `${100 / numColumns}%` }]}
            >
              <View style={styles.tile}>
                <Bone height="100%" radius={10} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        items.map((_, i) => (
          <View key={i} testID="list-skeleton-row">
            <ListRowSkeleton {...row} />
          </View>
        ))
      )}
    </SkeletonGroup>
  );
};

export default ListSkeleton;

const styles = StyleSheet.create({
  list: { flex: 1, paddingHorizontal: 12, paddingVertical: 8, overflow: "hidden" },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -GRID_GAP / 2 },
  cell: { padding: GRID_GAP / 2 },
  tile: { width: "100%", aspectRatio: 1 },
});
