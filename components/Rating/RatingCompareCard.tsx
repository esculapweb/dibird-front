import { View, Text, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import { useTheme, ThemeColors } from "../../store/theme-context";
import { Config } from "../../constants/config";
import { RatingCompareItem } from "../../types";

const DOT_SIZE = 10;

const ProfileDot = ({
  color,
  visible,
}: {
  color: string;
  visible: boolean;
}) => {
  const { Colors } = useTheme();
  return (
    <View
      style={[
        dotStyles.dot,
        { backgroundColor: visible ? color : Colors.imageBg },
      ]}
    />
  );
};

const RatingCompareCard = ({
  item,
  index,
  onPress,
}: {
  item: RatingCompareItem;
  index: number;
  onPress: () => void;
}) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const [in0, in1] = item.in_object ?? [false, false];

  const thumbUri = item.thumb ? `${Config.mediaUrl}/${item.thumb}` : null;

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        {thumbUri ? (
          <Image
            source={{ uri: thumbUri }}
            style={styles.image}
            contentFit="cover"
            cachePolicy="disk"
          />
        ) : (
          <View style={[styles.imagePlaceholder]}></View>
        )}

        <View style={styles.content}>
          <View style={styles.titleLeft}>
            <Text style={styles.index}>{index + 1}.</Text>
            <Text style={styles.title} numberOfLines={1}>
              {item.name_lang}
            </Text>
          </View>

          <View style={styles.latinRow}>
            <Text style={styles.latin} numberOfLines={1}>
              {item.name_latin}
            </Text>
          </View>
        </View>

        <View style={styles.dotsArea}>
          <ProfileDot color={Colors.compareP1} visible={in0} />
          <ProfileDot color={Colors.compareP2} visible={in1} />
        </View>
      </View>
    </Pressable>
  );
};

export default RatingCompareCard;

const dotStyles = StyleSheet.create({
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
});

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: Colors.primary100,
      borderRadius: 12,
      padding: 6,
      marginBottom: 4,
      shadowColor: Colors.shadow,
      shadowOpacity: 0.2,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    row: {
      flexDirection: "row",
      gap: 12,
    },
    content: {
      flex: 1,
      justifyContent: "flex-start",
      minWidth: 0,
    },
    titleLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      flexShrink: 1,
      minWidth: 0,
    },
    index: {
      fontSize: 12,
      color: Colors.textSecondary,
    },
    title: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors.textMain,
      lineHeight: 20,
      flexShrink: 1,
    },
    latinRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 1,
    },
    latin: {
      fontSize: 12,
      fontStyle: "italic",
      color: Colors.statIcon,
    },
    image: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: Colors.imageBg,
    },
    imagePlaceholder: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: Colors.imageBg,
      justifyContent: "center",
      alignItems: "center",
    },
    dotsArea: {
      flexDirection: "row",
      gap: 6,
      alignItems: "center",
      marginRight: 4,
    },
  });
