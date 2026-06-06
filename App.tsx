import { useState, ReactNode } from "react";
import { useColorScheme } from "react-native";
import "react-native-gesture-handler";
import "react-native-reanimated";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Navigation from "./navigation/Navigation";
import Toast from "react-native-toast-message";
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
import * as Updates from "expo-updates";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";

import AuthContextProvider, { useAuth } from "./store/auth-context";
import { ProfileProvider } from "./store/profile-context";
import { FiltersProvider } from "./store/filters-context";
import { LocationProvider } from "./store/location-context";
import { LanguageProvider } from "./store/language-context";
import { ThemeProvider, useTheme } from "./store/theme-context";
import ThemedToast from "./components/ui/ThemedToast";
import { initGoogleSignIn } from "./util/auth";
import { AppError } from "./types";
import GlobalBottomSheet from "./components/Providers/GlobalBottomSheet";
import CustomSplash from "./components/ui/CustomSplash";
import { initSentry } from "./services/sentry";
import { usePushNotifications } from "./hooks/usePushNotifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

initSentry();

initGoogleSignIn();

const appInitPromise: Promise<void> = (async () => {
  try {
    await setAnalyticsCollectionEnabled(getAnalytics(), !__DEV__);
  } catch (e) {
    Sentry.captureException(e, {
      tags: { context: "analytics-init" },
      level: "warning",
    });
  }

  if (!__DEV__ && Updates.isEnabled) {
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
      }
    } catch (e) {
      if (e instanceof Error && e.message.toLowerCase().includes("network")) {
        return;
      }
      Sentry.captureException(e, {
        tags: { context: "expo-updates" },
        level: "warning",
      });
    }
  }
})();

const queryClient = new QueryClient({
  queryCache: new QueryCache(),
  mutationCache: new MutationCache(),
  defaultOptions: {
    queries: {
      retry: (failureCount: number, error: Error) => {
         const appError = error as AppError;
        if (appError.code === "UNAUTHORIZED") return false;
        if (appError.isServerError) return false;
        return failureCount < 1;
      },
      staleTime: 10_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {},
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
  const { theme } = useTheme();
  const [splashFinished, setSplashFinished] = useState(false);
  const { isAuthenticated } = useAuth();

  usePushNotifications(isAuthenticated);

  if (!splashFinished) {
    return (
      <CustomSplash
        onFinish={() => setSplashFinished(true)}
        waitFor={appInitPromise}
      />
    );
  }

  return (
    <>
      <StatusBar
        style={theme === "dark" ? "light" : "dark"}
        translucent
        backgroundColor="transparent"
      />
      <Navigation />
      <Toast config={ThemedToast} position="bottom" />
      <GlobalBottomSheet />
    </>
  );
};

export default Sentry.wrap(function App() {
  const colorScheme = useColorScheme();
  const backgroundColor = colorScheme === "dark" ? "#1b1b1b" : "#ffffff";

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <ThemeProvider>
              <AuthContextProvider>
                <AuthConsumerWrapper>
                  <FiltersProvider>
                    <LocationProvider>
                      <BottomSheetModalProvider>
                        <Root />
                      </BottomSheetModalProvider>
                    </LocationProvider>
                  </FiltersProvider>
                </AuthConsumerWrapper>
              </AuthContextProvider>
            </ThemeProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
});
