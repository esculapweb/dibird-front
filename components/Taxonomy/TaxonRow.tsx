import { memo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { BirdSVG } from "../ui/Svgs";
import { resolveTaxonImage, iucnColors } from "../../util/taxonomy";

interface TaxonRowProps {
  title: string;
  latin?: string;
  thumb?: string | null;
  statusCode?: string | null;
  onPress: () => void;
}

const TaxonRow = memo(
  ({ title, latin, thumb, statusCode, onPress }: TaxonRowProps) => {
    const { Colors } = useTheme();
    const styles = stylesFn(Colors);
    const uri = resolveTaxonImage(thumb);
    const status = iucnColors(statusCode);

    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.pressedCard]}
        onPress={onPress}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={styles.thumb}
            contentFit="cover"
            cachePolicy="disk"
          />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <BirdSVG size={26} color={Colors.textSecondary} />
          </View>
        )}

        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
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
              {statusCode}
            </Text>
          </View>
        )}

        <Ionicons
          name="chevron-forward"
          size={20}
          color={Colors.textSecondary}
        />
      </Pressable>
    );
  },
);

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
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    statusText: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.3,
    },
  });
