import { StyleSheet, View } from "react-native";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { Bone, SkeletonGroup } from "../ui/Skeleton";

const H_PAD = 16;

const ChecklistHeroSkeleton = () => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  // The card is accent-coloured, so the bones are faint white rather than
  // the neutral grey used on plain cards.
  const bone = { color: Colors.primary100, baseOpacity: 0.2 };

  return (
    <SkeletonGroup style={styles.clCard}>
      <Bone width="68%" height={16} {...bone} style={styles.tag} />
      <View style={styles.clNumRow}>
        <Bone width={92} height={42} radius={10} {...bone} />
        <Bone width={78} height={18} {...bone} style={styles.of} />
      </View>
      <View style={styles.clBarBg} />
    </SkeletonGroup>
  );
};

export default ChecklistHeroSkeleton;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    clCard: {
      marginHorizontal: H_PAD,
      marginBottom: 12,
      backgroundColor: Colors.main100,
      borderRadius: 14,
      padding: 18,
    },
    tag: { marginBottom: 12 },
    clNumRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
    },
    of: { marginBottom: 4 },
    clBarBg: {
      marginTop: 16,
      height: 5,
      borderRadius: 3,
      backgroundColor: Colors.mainProgressBg,
    },
  });
