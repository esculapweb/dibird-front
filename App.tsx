import { useState, useEffect, ReactNode } from "react";
import "react-native-gesture-handler";
import "react-native-reanimated";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Navigation from "./navigation/Navigation";
import Toast from "react-native-toast-message";
import { ActionSheetProvider } from "@expo/react-native-action-sheet";
import "./services/i18n";
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from "@tanstack/react-query";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import * as Sentry from "@sentry/react-native";
import {
  getAnalytics,
  setAnalyticsCollectionEnabled,
} from "@react-native-firebase/analytics";

import AuthContextProvider, { useAuth } from "./store/auth-context";
import { ProfileProvider } from "./store/profile-context";
import { FiltersProvider } from "./store/filters-context";
import { LocationProvider } from "./store/location-context";
import { LanguageProvider } from "./store/language-context";
import { ThemeProvider, useTheme } from "./store/theme-context";
import ThemedToast from "./components/ui/ThemedToast";
import { showError } from "./services/api";
import { initGoogleSignIn } from "./util/auth";
import { AppError } from "./services/api";

import CustomSplash from "./components/ui/СustomSplash";

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: process.env.EXPO_PUBLIC_ENV,
  enabled: !__DEV__,
  sendDefaultPii: true,
  enableLogs: true,
});

initGoogleSignIn();

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => showError(error),
  }),
  mutationCache: new MutationCache({
    onError: (error) => showError(error),
  }),
  defaultOptions: {
    queries: {
      retry: (failureCount: number, error: AppError) => {
        if (error.code === "UNAUTHORIZED") return false;

        if (error.isServerError) return false;

        return failureCount < 1;
      },
      staleTime: 10_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      onError: (error: any) => {
        showError(error);
      },
    },
  },
});

const AuthConsumerWrapper = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  return (
    <ProfileProvider isAuthenticated={isAuthenticated}>
      {children}
    </ProfileProvider>
  );
};

const Root = () => {
  const { isInitializing } = useAuth();
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
  useEffect(() => {
    const init = async () => {
      await setAnalyticsCollectionEnabled(getAnalytics(), !__DEV__);
    };
    init();
  }, []);

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
