import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, ThemeColors } from "../../store/theme-context";
import { useTranslation } from "react-i18next";
import { IconType } from "../../types";
import { Theme } from "../../types";

interface ThemeSwitcherProps {
  // Same two variants as LanguageSwitcher — see the comment there.
  variant?: "drawer" | "settings";
}

const ThemeSwitcher = ({ variant = "drawer" }: ThemeSwitcherProps) => {
  const { manualTheme, toggleTheme, Colors } = useTheme();
  const { t } = useTranslation();
  const styles = stylesFn(Colors);
  const inSettings = variant === "settings";

  interface OptionType{
    value: Theme| null;
    text?: string;
    label: string;
    icon?: IconType
  }

  const options: OptionType[] = [
    { value: null, text: t("auto"), label: t("auto") },
    { value: "light", icon: "sunny-outline", label: t("light") },
    { value: "dark", icon: "moon-outline", label: t("dark") },
  ];

  return (
    <View style={[styles.container, inSettings && styles.containerInCard]}>
      <View style={styles.left}>
        <Ionicons
          name="color-palette-outline"
          size={inSettings ? 18 : 22}
          style={[styles.icon, inSettings && styles.iconInCard]}
        />
        <Text style={[styles.title, inSettings && styles.titleInCard]}>
          {t("theme")}
          {inSettings ? "" : ":"}
        </Text>
      </View>
      <View style={styles.buttonsRight}>
        {options.map((option) => {
          const isSelected = option.value === manualTheme;

          return (
            <Pressable
              key={option.value ?? "auto"}
              onPress={() => toggleTheme(option.value)}
              style={({ pressed }) => [
                styles.button,
                isSelected && { backgroundColor: Colors.main100 },
                pressed && styles.pressed,
              ]}
            >
              {option?.icon && (
                <Ionicons
                  name={option.icon}
                  size={20}
                  color={isSelected ? Colors.textOpposite : Colors.textMain}
                />
              )}
              {option?.text && (
                <Text style={{
                color: isSelected ? Colors.textOpposite : Colors.textMain,
              }}>{option.text}</Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

export default ThemeSwitcher;

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
      alignItems: "center",
      justifyContent: "center",
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
