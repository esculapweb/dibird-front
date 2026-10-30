import { StyleSheet, View } from "react-native";

import { Bone, SectionSkeleton, SkeletonGroup } from "../ui/Skeleton";

const PHOTO_SIZE = 150;

// SpeciesDetailScreen's header (gallery, breadcrumbs, names, IUCN badge)
// and the first overview sections, on the screen's own paddings.
const SpeciesDetailSkeleton = () => (
  <SkeletonGroup style={styles.root} testID="species-detail-skeleton">
    <View style={styles.header}>
      <View style={styles.gallery}>
        {[0, 1, 2].map((i) => (
          <Bone key={i} width={PHOTO_SIZE} height={PHOTO_SIZE} radius={14} />
        ))}
      </View>

      <Bone width="55%" height={12} radius={4} style={styles.crumbs} />

      <View style={styles.titleRow}>
        <View style={styles.titleTexts}>
          <Bone width="70%" height={24} radius={6} />
          <Bone width="50%" height={15} radius={4} baseOpacity={0.7} />
        </View>
        <Bone width={36} height={26} radius={8} />
      </View>
    </View>

    <SectionSkeleton lines={4} />
    <SectionSkeleton lines={2} />
  </SkeletonGroup>
);

export default SpeciesDetailSkeleton;

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 12, paddingTop: 8, overflow: "hidden" },
  header: { paddingHorizontal: 4, marginBottom: 8 },
  gallery: { flexDirection: "row", gap: 8, marginBottom: 12, overflow: "hidden" },
  crumbs: { marginBottom: 10 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 8 },
  titleTexts: { flex: 1, gap: 6 },
});
