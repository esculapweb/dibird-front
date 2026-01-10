import { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n from "../i18n";
import * as Localization from "expo-localization";

const LanguageContext = createContext({
  language: "en",
  changeLanguage: async (lang) => {},
  isReady: false,
});

const getDeviceLanguage = () => {
  const locales = Localization.getLocales();
  return locales?.[0]?.languageCode || "en";
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState("en");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      const stored = await AsyncStorage.getItem("language");
      const lang = stored || getDeviceLanguage();

      await i18n.changeLanguage(lang);
      setLanguage(lang);
      setIsReady(true);
    };

    init();
  }, []);

  const changeLanguage = async (lang) => {
    await i18n.changeLanguage(lang);
    setLanguage(lang);
    await AsyncStorage.setItem("language", lang);
  };

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, isReady }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
