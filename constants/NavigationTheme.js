import { DefaultTheme, DarkTheme } from "@react-navigation/native";

export const LightNavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: "#1E2A36",        
    background: "#F7F6F2",     
    card: "#F7F6F2",            
    text: "#1E2A36",            
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
    notification: "#F0C24B",
  },
};
