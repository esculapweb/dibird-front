import { View, Text, Pressable, StyleSheet } from "react-native";
import { useLanguage } from "../../store/language-context";
import { Ionicons } from "@expo/vector-icons";

import { Colors } from "../../constants/styles";

const LanguageSwitcher = () => {
  const { language, changeLanguage } = useLanguage();

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Ionicons
          name="globe-outline"
          size={22}
          // color={language === lang ? Colors.primary100 : Colors.primary500}
          style={styles.icon}
        />
        <Text style={styles.title}>Language:</Text>
      </View>
      <View style={styles.buttonsRight}>
        {["ru", "en"].map((lang) => (
          <Pressable
            key={lang}
            onPress={() => changeLanguage(lang)}
            style={[
              styles.button,
              language === lang && { backgroundColor: Colors.accent },
            ]}
          >
            <Text>{lang.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
};

export default LanguageSwitcher;

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderTopWidth: 1,
    borderColor: Colors.backgroundMain,
  },
  title: {
    paddingVertical: 8,
    marginRight: 16,
    fontSize: 14,
  },
  button: {
    padding: 8,
    marginRight: 8,
    borderRadius: 16,
    backgroundColor: Colors.primary100,
  },
  icon: {
    marginRight: 16,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
  },
  buttonsRight: {
    flexDirection: "row",
    marginLeft: "auto",
  },
});
