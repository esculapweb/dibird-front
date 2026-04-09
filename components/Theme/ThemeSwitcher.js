import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../store/theme-context";
import { useTranslation } from "react-i18next";

const ThemeSwitcher = () => {
  const { manualTheme, toggleTheme, Colors } = useTheme();
  const { t } = useTranslation();
  const styles = stylesFn(Colors);

  const options = [
    { value: null, text: t("auto"), label: t("auto") },
    { value: "light", icon: "sunny-outline", label: t("light") },
    { value: "dark", icon: "moon-outline", label: t("dark") },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Ionicons name="contrast-outline" size={22} style={styles.icon} />
        <Text style={styles.title}>{t("theme")}:</Text>
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

const stylesFn = (Colors) =>
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
  });
