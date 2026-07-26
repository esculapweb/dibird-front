import { memo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme, ThemeColors } from "../../store/theme-context";
import SpeciesThumb from "./SpeciesThumb";

interface TaxonRowProps {
  title: string;
  latin?: string;
  thumb?: string | null;
  statusCode?: string | null;
  // Already-localized line about how the species occurs on the territory the
  // list is filtered by ("Rare/Accidental"); only country lists have one.
  occurrence?: string | null;
  onPress: () => void;
}

const TaxonRow = memo(
  ({ title, latin, thumb, statusCode, occurrence, onPress }: TaxonRowProps) => {
    const { Colors } = useTheme();
    const styles = stylesFn(Colors);

    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.pressedCard]}
        onPress={onPress}
      >
        <SpeciesThumb thumb={thumb} statusCode={statusCode} />

        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {!!latin && (
            <Text style={styles.latin} numberOfLines={1}>
              {latin}
            </Text>
          )}
          {!!occurrence && (
            <Text style={styles.occurrence} numberOfLines={1}>
              {occurrence}
            </Text>
          )}
        </View>

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
    occurrence: {
      fontSize: 11,
      color: Colors.main100,
      marginTop: 2,
    },
  });
