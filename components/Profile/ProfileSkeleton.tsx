import { StyleSheet, View } from "react-native";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { Bone, SkeletonGroup } from "../ui/Skeleton";

// One labelled field of ProfileForm (Input / DropdownInput).
const FieldSkeleton = () => (
  <View style={styles.field}>
    <Bone width={90} height={14} radius={4} baseOpacity={0.7} />
    <Bone height={40} radius={4} />
  </View>
);

// ProfileForm as ProfileScreen lays it out: names side by side, username,
// country and timezone, then the two privacy toggles.
const ProfileSkeleton = () => {
  const { Colors } = useTheme();
  const themed = themedFn(Colors);

  return (
    <SkeletonGroup style={styles.root} testID="profile-skeleton">
      <View style={styles.row}>
        <View style={styles.rowItem}>
          <FieldSkeleton />
        </View>
        <View style={styles.rowItem}>
          <FieldSkeleton />
        </View>
      </View>
      <FieldSkeleton />
      <View style={themed.hairline} />
      <FieldSkeleton />
      <FieldSkeleton />
      <View style={themed.hairline} />
      {[0, 1].map((i) => (
        <View key={i} style={styles.field}>
          <Bone width={140} height={14} radius={4} baseOpacity={0.7} />
          <Bone height={44} radius={12} />
        </View>
      ))}
    </SkeletonGroup>
  );
};

export default ProfileSkeleton;

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, paddingTop: 24, overflow: "hidden" },
  row: { flexDirection: "row", gap: 12 },
  rowItem: { flex: 1 },
  field: { gap: 4, marginBottom: 16 },
});

const themedFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    hairline: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: Colors.tabBorder,
      marginBottom: 12,
      marginHorizontal: -12,
    },
  });
