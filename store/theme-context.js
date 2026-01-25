import { createContext, useState, useMemo, useContext } from "react";
import { Appearance } from "react-native";
import { LightColors } from "../constants/colors/light";
import { DarkColors } from "../constants/colors/dark";

const ThemeContext = createContext({
  theme: "light",
  Colors: LightColors,
  toggleTheme: () => {},
});

export const ThemeProvider = ({ children }) => {
  const systemTheme = Appearance.getColorScheme() || "light";
  const [theme, setTheme] = useState(systemTheme);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const value = useMemo(() => {
    return {
      theme,
      Colors: theme === "dark" ? DarkColors : LightColors,
      toggleTheme,
    };
  }, [theme]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
