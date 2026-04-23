import "react-native-gesture-handler";
import "react-native-reanimated";
import { StatusBar } from "expo-status-bar";
import { useContext, useState, useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Navigation from "./navigation/Navigation";
import Toast from "react-native-toast-message";
import { ActionSheetProvider } from "@expo/react-native-action-sheet";
import "./services/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import * as Sentry from "@sentry/react-native";

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

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: process.env.EXPO_PUBLIC_ENV,
  // enabled: !__DEV__,

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  enableLogs: true,

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

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
    },
    mutations: {
      onError: (error) => {
        showError(error);
      },
    },
  },
});

const AuthConsumerWrapper = ({ children }) => {
  const { isAuthenticated } = useContext(AuthContext);
  return (
    <ProfileProvider isAuthenticated={isAuthenticated}>
      {children}
    </ProfileProvider>
  );
};

const Root = () => {
  const { isInitializing, isAuthenticated } = useContext(AuthContext);
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

export default Sentry.wrap(function App() {

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <ThemeProvider>
              <AuthContextProvider>
                <AuthConsumerWrapper>
                  <FiltersProvider>
                    <LocationProvider>
                      <Root />
                    </LocationProvider>
                  </FiltersProvider>
                </AuthConsumerWrapper>
              </AuthContextProvider>
            </ThemeProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
});
