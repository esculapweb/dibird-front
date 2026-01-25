import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../store/theme-context";
import { useTranslation } from "react-i18next";

const ThemeSwitcher = () => {
  const { theme, toggleTheme, Colors } = useTheme();
  const { t } = useTranslation();
  const isDark = theme === "dark";
  const styles = stylesFn(Colors);

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Ionicons
          name="contrast-outline"
          size={22}
          style={styles.icon}
        />
        <Text style={styles.title}>{t("theme")}:</Text>
      </View>
      <View style={styles.buttonsRight}>
        {[
          { value: "light", icon: "sunny-outline" },
          { value: "dark", icon: "moon-outline" },
        ].map((option) => (
          <Pressable
            key={option.value}
            onPress={() => toggleTheme(option.value)}
            style={({ pressed }) => [
              styles.button,
              isDark === (option.value === "dark") && {
                backgroundColor: Colors.primary200,
              },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name={option.icon} size={20} color={Colors.textMain} />
          </Pressable>
        ))}
      </View>
    </View>
  );
};

export default ThemeSwitcher;

const stylesFn = (Colors) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      flexDirection: "row",
      alignItems: "center",
      borderTopWidth: 1,
      borderColor: Colors.backgroundMain,
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
      backgroundColor: Colors.primary100,
      alignItems: "center",
      justifyContent: "center",
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
