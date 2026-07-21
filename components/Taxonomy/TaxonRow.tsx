import { memo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { Config } from "../../constants/config";
import { BirdSVG } from "../ui/Svgs";
import { TaxonListItem, TaxonRank } from "../../types";

interface TaxonRowProps {
  item: TaxonListItem;
  rank: TaxonRank;
  onPress: () => void;
}

const TaxonRow = memo(({ item, rank, onPress }: TaxonRowProps) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const isSpecies = rank === 5;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressedCard]}
      onPress={onPress}
    >
      {isSpecies && (
        <View style={styles.thumb}>
          {item.thumb ? (
            <Image
              source={{ uri: `${Config.mediaUrl}/${item.thumb}` }}
              style={styles.thumb}
              contentFit="cover"
              cachePolicy="disk"
            />
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder]}>
              <BirdSVG size={26} color={Colors.textSecondary} />
            </View>
          )}
        </View>
      )}

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {item.name_lang}
        </Text>
        {item.name && item.name !== item.name_lang && (
          <Text style={styles.latin} numberOfLines={1}>
            {item.name}
          </Text>
        )}
        {isSpecies && item.status_name && (
          <Text style={styles.status} numberOfLines={1}>
            {item.status_name}
          </Text>
        )}
      </View>

      <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
    </Pressable>
  );
});

export default TaxonRow;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: Colors.primary100,
      borderRadius: 12,
      padding: 8,
      marginBottom: 4,
      gap: 10,
    },
    pressedCard: { opacity: 0.85 },
    thumb: {
      width: 52,
      height: 52,
      borderRadius: 10,
      backgroundColor: Colors.imageBg,
      overflow: "hidden",
    },
    thumbPlaceholder: {
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: Colors.primary200,
    },
    info: {
      flex: 1,
      justifyContent: "center",
    },
    title: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors.textMain,
    },
    latin: {
      fontSize: 12,
      fontStyle: "italic",
      color: Colors.textSecondary,
      marginTop: 2,
    },
    status: {
      fontSize: 11,
      color: Colors.main100,
      marginTop: 2,
    },
  });
