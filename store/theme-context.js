import { createContext, useMemo, useContext, useState, useEffect } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LightColors } from "../constants/colors/light";
import { DarkColors } from "../constants/colors/dark";

const ThemeContext = createContext(null);

const THEME_KEY = "theme";

export const ThemeProvider = ({ children }) => {
  const systemScheme = useColorScheme(); 
  const [manualTheme, setManualTheme] = useState(null);
  const [ready, setReady] = useState(false); 

  useEffect(() => {
    (async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_KEY);
        if (savedTheme === "light" || savedTheme === "dark") {
          setManualTheme(savedTheme);
        }
      } catch (e) {
        console.warn("Failed to load theme from storage", e);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const theme = manualTheme ?? systemScheme ?? "light";

  const toggleTheme = (newTheme) => {
    if (newTheme === null) {
      setManualTheme(null);
      AsyncStorage.removeItem(THEME_KEY).catch(() =>
        console.warn("Failed to remove theme from storage")
      );
      return;
    }

    if (newTheme !== "light" && newTheme !== "dark") return;

    setManualTheme(newTheme);
    AsyncStorage.setItem(THEME_KEY, newTheme).catch(() =>
      console.warn("Failed to save theme to storage")
    );
  };

  const value = useMemo(
    () => ({
      theme,
      Colors: theme === "dark" ? DarkColors : LightColors,
      toggleTheme,
    }),
    [theme]
  );

  if (!ready) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
