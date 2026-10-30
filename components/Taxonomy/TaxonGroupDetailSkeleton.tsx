import { StyleSheet, View } from "react-native";

import { Bone, ListSkeleton, SkeletonGroup } from "../ui/Skeleton";

// TaxonGroupDetailScreen: hero photo, breadcrumbs, names and count chips,
// then the start of the children list — all of it the list's header there.
const TaxonGroupDetailSkeleton = () => (
  <SkeletonGroup style={styles.root} testID="taxon-group-detail-skeleton">
    <View style={styles.header}>
      <Bone height={180} radius={14} style={styles.hero} />
      <Bone width="50%" height={12} radius={4} style={styles.crumbs} />
      <Bone width="65%" height={24} />
      <Bone width="45%" height={15} radius={4} baseOpacity={0.7} style={styles.latin} />
      <View style={styles.chipsRow}>
        <Bone width={80} height={22} radius={8} />
        <Bone width={64} height={22} radius={8} />
      </View>
      <Bone width={120} height={13} radius={4} style={styles.childrenTitle} />
    </View>
    <ListSkeleton count={4} padded={false} />
  </SkeletonGroup>
);

export default TaxonGroupDetailSkeleton;

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 12, paddingVertical: 8, overflow: "hidden" },
  header: { marginBottom: 4, paddingHorizontal: 4 },
  hero: { marginBottom: 12 },
  crumbs: { marginBottom: 10 },
  latin: { marginTop: 6 },
  chipsRow: { flexDirection: "row", gap: 6, marginTop: 8, marginBottom: 4 },
  childrenTitle: { marginTop: 12, marginBottom: 6 },
});
