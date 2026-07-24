import { memo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { latinPart, iucnColors } from "../../util/taxonomy";
import { TerritoryCompareSpecies } from "../../types";

const DOT_SIZE = 10;

// Same two-colour dot pair as the users' comparison (RatingCompareCard): one
// dot per side, filled when that territory has the species.
const PresenceDot = ({
  color,
  visible,
  testID,
}: {
  color: string;
  visible: boolean;
  testID: string;
}) => {
  const { Colors } = useTheme();
  return (
    <View
      testID={testID}
      style={[
        dotStyles.dot,
        { backgroundColor: visible ? color : Colors.imageBg },
      ]}
    />
  );
};

const TerritoryCompareRow = memo(
  ({
    item,
    onPress,
  }: {
    item: TerritoryCompareSpecies;
    onPress: () => void;
  }) => {
    const { Colors } = useTheme();
    const styles = stylesFn(Colors);
    const [inFirst, inSecond] = item.in_object ?? [false, false];
    const status = iucnColors(item.status);
    const latin = latinPart(item.name, item.name_lang);

    return (
      <Pressable style={styles.card} onPress={onPress}>
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {item.name_lang}
          </Text>
          {!!latin && (
            <Text style={styles.latin} numberOfLines={1}>
              {latin}
            </Text>
          )}
        </View>

        {status && (
          <View style={[styles.status, { backgroundColor: status.background }]}>
            <Text style={[styles.statusText, { color: status.text }]}>
              {item.status}
            </Text>
          </View>
        )}

        <View style={styles.dots}>
          <PresenceDot
            color={Colors.compareP1}
            visible={inFirst}
            testID="presence-dot-0"
          />
          <PresenceDot
            color={Colors.compareP2}
            visible={inSecond}
            testID="presence-dot-1"
          />
        </View>
      </Pressable>
    );
  },
);

export default TerritoryCompareRow;

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
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: Colors.primary100,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginBottom: 4,
    },
    info: { flex: 1, minWidth: 0 },
    title: {
      fontSize: 14,
      fontWeight: "600",
      color: Colors.textMain,
    },
    latin: {
      fontSize: 11,
      fontStyle: "italic",
      color: Colors.textSecondary,
      marginTop: 1,
    },
    status: {
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    statusText: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.3,
    },
    dots: { flexDirection: "row", gap: 6, alignItems: "center" },
  });
