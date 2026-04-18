import { View, StyleSheet } from "react-native";
import { useTheme } from "../../store/theme-context";

const H_PAD = 16;
const IMAGE_SIZE = 64;

const BirdOfTheDaySkeleton = () => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <View style={styles.botdCard}>
      <View style={styles.botdStrip}>
        <View style={styles.botdStripLeft}>
          <View style={styles.skeletonIcon} />
          <View style={styles.skeletonTitle} />
        </View>
        <View style={styles.skeletonSub} />
      </View>

      <View style={styles.botdBody}>
        <View style={styles.skeletonImage} />
        <View style={styles.botdText}>
          <View style={styles.skeletonName} />
          <View style={styles.skeletonLatin} />
          <View style={styles.skeletonHint} />
        </View>
      </View>
    </View>
  );
};

export default BirdOfTheDaySkeleton;

const stylesFn = (Colors) =>
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
    },
    skeletonIcon: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: Colors.textOpposite,
      opacity: 0.3,
    },
    skeletonTitle: {
      width: 100,
      height: 14,
      borderRadius: 4,
      backgroundColor: Colors.textOpposite,
      opacity: 0.3,
    },
    skeletonSub: {
      width: 70,
      height: 12,
      borderRadius: 4,
      backgroundColor: Colors.textOpposite,
      opacity: 0.3,
    },
    skeletonImage: {
      width: IMAGE_SIZE,
      height: IMAGE_SIZE,
      borderRadius: 12,
      backgroundColor: Colors.imageBg,
    },
    skeletonName: {
      width: "80%",
      height: 16,
      borderRadius: 4,
      backgroundColor: Colors.imageBg,
    },
    skeletonLatin: {
      width: "50%",
      height: 13,
      borderRadius: 4,
      backgroundColor: Colors.imageBg,
      marginTop: 6,
    },
    skeletonHint: {
      width: "60%",
      height: 13,
      borderRadius: 4,
      backgroundColor: Colors.imageBg,
      marginTop: 8,
    },
  });
