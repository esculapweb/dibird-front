import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme, ThemeColors } from "../../store/theme-context";

const H_PAD = 16;

// A caption for the add buttons directly above, shown only until the first
// record exists. Deliberately not a card with its own "add observation"
// button: that repeated the button a centimetre above it, and the screen
// around it (checklist, rare nearby, bird of the day) is not empty either.
const WelcomeCard = () => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <View style={styles.hint} testID="welcome-card">
      <Ionicons
        name="sparkles-outline"
        size={14}
        color={Colors.textSecondary}
      />
      <Text style={styles.text}>{t("welcome_card_text")}</Text>
    </View>
  );
};

export default WelcomeCard;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    hint: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
      marginHorizontal: H_PAD,
      marginTop: -4,
      marginBottom: 14,
    },
    text: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      color: Colors.textSecondary,
    },
  });
