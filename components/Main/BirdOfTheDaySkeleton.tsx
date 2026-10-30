import { View, StyleSheet } from "react-native";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { Bone, SkeletonGroup } from "../ui/Skeleton";

const H_PAD = 16;
const IMAGE_SIZE = 64;

const BirdOfTheDaySkeleton = () => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <SkeletonGroup style={styles.botdCard}>
      <View style={styles.botdStrip}>
        <View style={styles.botdStripLeft}>
          <Bone circle height={16} color={Colors.textOpposite} baseOpacity={0.3} />
          <Bone width={100} height={14} radius={4} color={Colors.textOpposite} baseOpacity={0.3} />
        </View>
        <Bone width={70} height={12} radius={4} color={Colors.textOpposite} baseOpacity={0.3} />
      </View>

      <View style={styles.botdBody}>
        <Bone width={IMAGE_SIZE} height={IMAGE_SIZE} radius={12} />
        <View style={styles.botdText}>
          <Bone width="80%" height={16} radius={4} />
          <Bone width="50%" height={13} radius={4} baseOpacity={0.7} />
          <Bone width="60%" height={13} radius={4} baseOpacity={0.7} />
        </View>
      </View>

      {/* Stands in for the "add observation" button, which the real card
          always has — without it the card grew by a row on arrival. */}
      <View style={styles.botdAction}>
        <Bone width={140} height={18} radius={4} />
      </View>
    </SkeletonGroup>
  );
};

export default BirdOfTheDaySkeleton;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    botdCard: {
      marginHorizontal: H_PAD,
      marginBottom: 12,
      borderRadius: 14,
      borderWidth: 0.5,
      borderColor: Colors.border,
      overflow: "hidden",
    },
    botdStrip: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: Colors.main100,
      opacity: 0.5,
    },
    botdStripLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    botdBody: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingHorizontal: 16,
      paddingVertical: 16,
      backgroundColor: Colors.primary100,
    },
    botdText: {
      flex: 1,
      gap: 7,
    },
    botdAction: {
      alignItems: "center",
      paddingVertical: 12,
      borderTopWidth: 0.5,
      borderTopColor: Colors.border,
      backgroundColor: Colors.primary100,
    },
  });
