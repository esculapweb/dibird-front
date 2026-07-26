import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n from "../services/i18n";
import * as Localization from "expo-localization";
import { setUserProps } from "../services/analytics";

interface LanguageContextType {
  language: string;
  changeLanguage: (lang: string) => Promise<void>;
  isReady: boolean;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

const getDeviceLanguage = () => {
  const locales = Localization.getLocales();
  return locales?.[0]?.languageCode || "en";
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState("en");
  const [isReady, setIsReady] = useState(false);

  // Язык интерфейса — не язык устройства: у не-EN рынков это как раз то
  // измерение, ради которого план и различает рынки в отчётах.
  useEffect(() => {
    if (!isReady) return;
    setUserProps({ ui_language: language });
  }, [language, isReady]);

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

  const changeLanguage = async (lang: string) => {
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

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context)
    throw new Error("useLanguage must be used within LanguageProvider");
  return context;
};
