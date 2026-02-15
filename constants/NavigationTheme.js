import { DefaultTheme, DarkTheme } from "@react-navigation/native";

export const LightNavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: "#1f2937",        
    background: "#f0f0f0",     
    card: "#ffffff",            
    text: "#1f2937",            
    border: "#ced4da",          
    notification: "#f0c24b",   
  },
};

export const DarkNavigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: "#e5e7eb",
    background: "#121212",
    card: "#121212",
    text: "#e5e7eb",
    border: "#374151",
    notification: "#1e293b",
  },
};
