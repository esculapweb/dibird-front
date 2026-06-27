import {
  createContext,
  useMemo,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { Appearance, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LightColors } from "../constants/colors/light";
import { DarkColors } from "../constants/colors/dark";
import { Theme } from "../types";

export type ThemeColors = typeof LightColors;

interface ThemeContextType {
  theme: Theme;
  manualTheme: Theme | null;
  Colors: ThemeColors;
  isDark: boolean;
  toggleTheme: (newTheme: Theme | null) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const THEME_KEY = "theme";

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const initialSystemTheme = Appearance.getColorScheme();
  const systemScheme = useColorScheme();
  const [manualTheme, setManualTheme] = useState<Theme | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_KEY);
        if (savedTheme === "light" || savedTheme === "dark") {
          setManualTheme(savedTheme as Theme);
          Appearance.setColorScheme(savedTheme as Theme);
        } else {
          Appearance.setColorScheme("unspecified");
        }
      } catch (e) {
        if (__DEV__) console.warn("Failed to load theme from storage", e);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const currentSystemTheme = systemScheme || initialSystemTheme || "light";

  const theme: Theme =
    manualTheme ?? (currentSystemTheme === "dark" ? "dark" : "light");

  const toggleTheme = (newTheme: Theme | null) => {
    if (newTheme === null) {
      setManualTheme(null);
      Appearance.setColorScheme("unspecified");
      AsyncStorage.removeItem(THEME_KEY).catch(
        () => __DEV__ && console.warn("Failed to remove theme from storage"),
      );
      return;
    }

    setManualTheme(newTheme);
    Appearance.setColorScheme(newTheme);
    AsyncStorage.setItem(THEME_KEY, newTheme).catch(
      () => __DEV__ && console.warn("Failed to save theme to storage"),
    );
  };

  const value = useMemo(
    () => ({
      theme,
      manualTheme,
      Colors: theme === "dark" ? DarkColors : LightColors,
      isDark: theme === "dark",
      toggleTheme,
    }),
    [theme, manualTheme],
  );

  if (!ready) return null;

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
};
