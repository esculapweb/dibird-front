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
import { ThemeProvider } from "./store/theme-context";

SplashScreen.preventAutoHideAsync();

const Root = () => {
  const { isInitializing } = useContext(AuthContext);

  useEffect(() => {
    if (!isInitializing) {
      SplashScreen.hide();
    }
  }, [isInitializing]);

  if (isInitializing) {
    return null;
  }

  return (
    <ActionSheetProvider>
      <Navigation />
    </ActionSheetProvider>
  );
};

export default function App() {
  return (
    <>
      <StatusBar style="light" />
      <LanguageProvider>
        <ThemeProvider>
          <AuthContextProvider>
            <ProfileProvider>
              <Root />
              <Toast
                config={{
                  error: (props) => (
                    <ErrorToast {...props} text2NumberOfLines={6} />
                  ),
                }}
                position="bottom"
              />
            </ProfileProvider>
          </AuthContextProvider>
        </ThemeProvider>
      </LanguageProvider>
    </>
  );
}
