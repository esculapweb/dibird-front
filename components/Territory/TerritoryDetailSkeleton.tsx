import { StyleSheet, View } from "react-native";

import { Bone, ListSkeleton, SkeletonGroup, SkeletonText } from "../ui/Skeleton";

// TerritoryDetailScreen opens on one of two tabs: the species list, or the
// description with the flag-and-name header — mirror whichever it opens on.
const TerritoryDetailSkeleton = ({ tab }: { tab: "species" | "info" }) => {
  if (tab === "species")
    return <ListSkeleton testID="territory-detail-skeleton" />;

  return (
    <SkeletonGroup style={styles.root} testID="territory-detail-skeleton">
      <View style={styles.titleRow}>
        <Bone circle height={34} />
        <View style={styles.titleTexts}>
          <Bone width="60%" height={24} />
          <Bone width="35%" height={13} radius={4} baseOpacity={0.7} />
        </View>
      </View>
      <SkeletonText lines={5} lastWidth="45%" style={styles.text} />
    </SkeletonGroup>
  );
};

export default TerritoryDetailSkeleton;

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16, paddingVertical: 8, overflow: "hidden" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  titleTexts: { flex: 1, gap: 6 },
  text: { marginTop: 16 },
});
