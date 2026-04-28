import { View, Text, Pressable, StyleSheet } from "react-native";
import { useLanguage } from "../../store/language-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme, ThemeColors } from "../../store/theme-context";

const LanguageSwitcher = () => {
  const { language, changeLanguage } = useLanguage();
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Ionicons name="globe-outline" size={22} style={styles.icon} />
        <Text style={styles.title}>{t("language")}:</Text>
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
  });
