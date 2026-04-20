import "react-native-gesture-handler";
import "react-native-reanimated";
import { StatusBar } from "expo-status-bar";
import { useContext, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Navigation from "./navigation/Navigation";
import Toast from "react-native-toast-message";
import { ActionSheetProvider } from "@expo/react-native-action-sheet";
import "./services/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

import AuthContextProvider, { AuthContext } from "./store/auth-context";
import { ProfileProvider } from "./store/profile-context";
import { FiltersProvider } from "./store/filters-context";
import { LocationProvider } from "./store/location-context";
import { LanguageProvider } from "./store/language-context";
import { ThemeProvider, useTheme } from "./store/theme-context";
import ThemedToast from "./components/ui/ThemedToast";
import { showError } from "./services/api";
import { initGoogleSignIn } from "./util/auth";

import CustomSplash from "./components/ui/СustomSplash";

initGoogleSignIn();

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

const Root = () => {
  const { isInitializing } = useContext(AuthContext);
  const { theme } = useTheme();
  const [splashFinished, setSplashFinished] = useState(false);

  if (isInitializing || !splashFinished) {
    return <CustomSplash onFinish={() => setSplashFinished(true)} />;
  }

  return (
    <>
      <StatusBar
        style={theme === "dark" ? "light" : "dark"}
        translucent
        backgroundColor="transparent"
      />
      <ActionSheetProvider>
        <Navigation />
      </ActionSheetProvider>
      <Toast config={ThemedToast} position="bottom" />
    </>
  );
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <ThemeProvider>
              <AuthContextProvider>
                <ProfileProvider>
                  <FiltersProvider>
                    <LocationProvider>
                      <Root />
                    </LocationProvider>
                  </FiltersProvider>
                </ProfileProvider>
              </AuthContextProvider>
            </ThemeProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
