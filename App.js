import { StatusBar } from "expo-status-bar";
import { useEffect, useContext } from "react";
import Navigation from "./navigation/Navigation";
import * as SplashScreen from "expo-splash-screen";
import Toast from "react-native-toast-message";
import { ActionSheetProvider } from "@expo/react-native-action-sheet";
import "./services/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import AuthContextProvider, { AuthContext } from "./store/auth-context";
import { ProfileProvider } from "./store/profile-context";
import { LanguageProvider } from "./store/language-context";
import { ThemeProvider, useTheme } from "./store/theme-context";
import ThemedToast from "./components/ui/ThemedToast";

import { showError } from "./services/api";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error.code === "UNAUTHORIZED") return false;

        if (error.isServerError) return false;

        return failureCount < 1;
      },

      onError: (error) => {
        showError(error);
      },
      staleTime: 10_000, 
      cacheTime: 5 * 60_000,
      refetchOnFocus: false,
      refetchOnReconnect: true,

      mutations: {
        onError: (error) => {
          showError(error);
        },
      },
    },
  },
});

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
      <Toast config={ThemedToast} position="bottom" />
    </>
  );
};

export default function App() {
  return (
    <>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <ThemeProvider>
            <AuthContextProvider>
              <ProfileProvider>
                <Root />
              </ProfileProvider>
            </AuthContextProvider>
          </ThemeProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </>
  );
}
