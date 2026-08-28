// Must come before i18next is configured. Hermes ships a partial Intl without
// Intl.PluralRules, and i18next silently falls back to an English-shaped
// one/other rule when it is missing: every Russian count landed on the _other
// form, so "Показать 6 наблюдения" instead of "наблюдений". The polyfill
// installs itself only when the engine has no PluralRules of its own (or one
// that does not know ru), so it costs nothing where Intl is complete.
import "intl-pluralrules";
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
  compatibilityJSON: "v4",
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
  debug: false,
});

export default i18n;
