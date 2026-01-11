import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";

import en from "../locales/en.json";
import ru from "../locales/ru.json";

const getDeviceLanguage = () => {
  try {
    const locales = Localization.getLocales();
    return locales?.[0]?.languageCode || "en";
  } catch {
    return "en";
  }
};

i18n.use(initReactI18next).init({
  compatibilityJSON: "v3",
  lng: getDeviceLanguage(),
  fallbackLng: "en",
  supportedLngs: ["en", "ru"],
  resources: {
    en: { translation: en },
    ru: { translation: ru },
  },
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
