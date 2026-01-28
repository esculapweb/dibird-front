import { StatusBar } from "expo-status-bar";
import { useEffect, useContext } from "react";
import Navigation from "./navigation/Navigation";
import * as SplashScreen from "expo-splash-screen";
import Toast, { ErrorToast } from "react-native-toast-message";
import { ActionSheetProvider } from "@expo/react-native-action-sheet";
import "./services/i18n";

import AuthContextProvider, { AuthContext } from "./store/auth-context";
import { ProfileProvider } from "./store/profile-context";
import { LanguageProvider } from "./store/language-context";
import { ThemeProvider, useTheme } from "./store/theme-context";
import ThemedToast from "./components/ui/ThemedToast";

SplashScreen.preventAutoHideAsync();

const Root = () => {
  const { isInitializing } = useContext(AuthContext);
  const { theme } = useTheme();

  useEffect(() => {
    if (!isInitializing) {
      SplashScreen.hide();
    }
  }, [isInitializing]);

  if (isInitializing) {
    return null;
  }

  return (
    <>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      <ActionSheetProvider>
        <Navigation />
      </ActionSheetProvider>
      <Toast
        // config={{
        //   error: (props) => <ErrorToast {...props} text2NumberOfLines={6} />,
        // }}
        config={ThemedToast}
        position="bottom"
      />
    </>
  );
};

export default function App() {
  return (
    <>
      <LanguageProvider>
        <ThemeProvider>
          <AuthContextProvider>
            <ProfileProvider>
              <Root />
            </ProfileProvider>
          </AuthContextProvider>
        </ThemeProvider>
      </LanguageProvider>
    </>
  );
}
