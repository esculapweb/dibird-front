import { View, Text, Pressable, StyleSheet } from "react-native";
import { useLanguage } from "../../store/language-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme, ThemeColors } from "../../store/theme-context";

interface LanguageSwitcherProps {
  // "drawer" draws the switcher the way the drawer footer needs it — with its
  // own top divider and padding. "settings" makes it line up with the rows of a
  // SettingsList card, where the divider is drawn by the section instead. The
  // switcher lives in both places: the drawer keeps it one tap away, Settings is
  // where people go looking for it.
  variant?: "drawer" | "settings";
}

const LanguageSwitcher = ({ variant = "drawer" }: LanguageSwitcherProps) => {
  const { language, changeLanguage } = useLanguage();
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const inSettings = variant === "settings";

  return (
    <View style={[styles.container, inSettings && styles.containerInCard]}>
      <View style={styles.left}>
        <Ionicons
          name="language-outline"
          size={inSettings ? 18 : 22}
          style={[styles.icon, inSettings && styles.iconInCard]}
        />
        <Text style={[styles.title, inSettings && styles.titleInCard]}>
          {t("language")}
          {inSettings ? "" : ":"}
        </Text>
      </View>
      <View style={styles.buttonsRight}>
        {["en", "ru"].map((lang) => {
          const isSelected = language === lang;
          return (
            <Pressable
              key={lang}
              onPress={() => changeLanguage(lang)}
              style={({ pressed }) => [
                styles.button,
                isSelected && { backgroundColor: Colors.main100 },
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={{
                  color: isSelected ? Colors.textOpposite : Colors.textMain,
                }}
              >
                {lang.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

export default LanguageSwitcher;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      flexDirection: "row",
      alignItems: "center",
      borderTopWidth: 1,
      borderColor: Colors.divider,
    },
    title: {
      paddingVertical: 8,
      marginRight: 16,
      fontSize: 14,
      color: Colors.textMain,
    },
    button: {
      padding: 8,
      marginRight: 8,
      borderRadius: 16,
      backgroundColor: Colors.backgroundMain,
    },
    icon: {
      marginRight: 16,
      color: Colors.textMain,
    },
    left: {
      flexDirection: "row",
      alignItems: "center",
    },
    buttonsRight: {
      flexDirection: "row",
      marginLeft: "auto",
    },
    pressed: {
      opacity: 0.7,
    },
    containerInCard: {
      borderTopWidth: 0,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    titleInCard: {
      fontSize: 15,
    },
    iconInCard: {
      marginRight: 12,
      color: Colors.main100,
    },
  });
