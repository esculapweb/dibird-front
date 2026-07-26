import { memo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { isoToFlagEmoji } from "../../util/helpers";

interface TerritoryRowProps {
  name: string;
  // ISO-3166 alpha-2; a handful of territories have none, and then the row
  // shows a globe instead of a flag.
  code?: string | null;
  // Already-localized, number-agreed label from the API ("1111 species"), not
  // a number to format here.
  speciesLabel?: string | null;
  // Localized region name; missing on offline-cached rows from before the
  // backend started sending it.
  regionName?: string | null;
  onPress: () => void;
}

const TerritoryRow = memo(
  ({ name, code, speciesLabel, regionName, onPress }: TerritoryRowProps) => {
    const { t } = useTranslation();
    const { Colors } = useTheme();
    const styles = stylesFn(Colors);
    const flag = isoToFlagEmoji(code ?? null);

    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.pressedCard]}
        onPress={onPress}
      >
        <View style={styles.flagWrap}>
          {flag ? (
            <Text style={styles.flag}>{flag}</Text>
          ) : (
            <Ionicons
              name="globe-outline"
              size={22}
              color={Colors.textSecondary}
            />
          )}
        </View>

        <View style={styles.info}>
          {/* One line now that the region takes the third one — a two-line
              name plus two subtitles would outgrow the row. */}
          <Text style={styles.title} numberOfLines={1}>
            {name}
          </Text>
          {!!regionName && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {t("region")}: {regionName}
            </Text>
          )}
          {!!speciesLabel && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {speciesLabel}
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

export default TerritoryRow;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: Colors.primary100,
      borderRadius: 12,
      padding: 10,
      marginBottom: 4,
      gap: 10,
    },
    pressedCard: { opacity: 0.85 },
    flagWrap: {
      width: 40,
      height: 40,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: Colors.primary200,
    },
    // Flag emoji render smaller than their em box on both platforms, so this
    // is deliberately larger than the text around it.
    flag: { fontSize: 24 },
    info: { flex: 1, justifyContent: "center" },
    title: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors.textMain,
    },
    subtitle: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginTop: 2,
    },
  });
