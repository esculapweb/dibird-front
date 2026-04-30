import { View, Button } from "react-native";
import { useLanguage } from "../store/language-context";

const SettingsScreen = () => {
  const { language, changeLanguage } = useLanguage();

  return (
    <View>
      <Button
        title="Русский"
        onPress={() => changeLanguage("ru")}
        disabled={language === "ru"}
      />
      <Button
        title="English"
        onPress={() => changeLanguage("en")}
        disabled={language === "en"}
      />
    </View>
  );
};

export default SettingsScreen;
