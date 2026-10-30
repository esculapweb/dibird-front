import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { useTheme, ThemeColors } from "../../../store/theme-context";
import { Bone, SkeletonText } from "./Skeleton";

// The card of components/ui/Section with a title bar, filled with text lines
// unless given children of its own.
const SectionSkeleton = ({
  lines = 3,
  children,
}: {
  lines?: number;
  children?: ReactNode;
}) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <View style={styles.section}>
      <Bone width={110} height={13} radius={4} style={styles.title} />
      {children ?? <SkeletonText lines={lines} />}
    </View>
  );
};

export default SectionSkeleton;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    section: {
      marginBottom: 8,
      backgroundColor: Colors.primary100,
      borderRadius: 14,
      padding: 16,
    },
    title: { marginBottom: 12 },
  });
