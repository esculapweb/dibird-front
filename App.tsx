import { useState, ReactNode, useEffect } from "react";
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
  useQueryClient,
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
import Constants from "expo-constants";

import AuthContextProvider, { useAuth } from "./store/auth-context";
import { ProfileProvider } from "./store/profile-context";
import { FiltersProvider } from "./store/filters-context";
import { LocationProvider } from "./store/location-context";
import { LanguageProvider } from "./store/language-context";
import { ThemeProvider, useTheme } from "./store/theme-context";
import ThemedToast from "./components/ui/ThemedToast";
import { initGoogleSignIn } from "./util/auth";
import { AppError, isNotificationPayload } from "./types";
import GlobalBottomSheet from "./components/Providers/GlobalBottomSheet";
import CustomSplash from "./components/ui/CustomSplash";
import { registerPushToken } from "./util/fetches";
import { UNREAD_COUNT_KEY } from "./hooks/useUnreadCount";
import { navigateFromNotification } from "./services/navigationRef";
import { initSentry } from "./services/sentry";

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
    mutations: {},
  },
});

const usePushNotifications = (isAuthenticated: boolean) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated) return;

    async function register() {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") return;

      const token = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });
      await registerPushToken(token.data);
    }
    register();

    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const raw = response.notification.request.content.data;

        if (!isNotificationPayload(raw)) return;

        // TypeScript теперь знает точный тип на каждой ветке
        switch (raw.screen) {
          case "AlertsFeed":
            navigateFromNotification("AlertsFeed", {
              highlightObsId: raw.obsId,
            });
            break;
          case "SpeciesDetail":
            navigateFromNotification("SpeciesDetail", { id: raw.speciesId });
            break;
          case "Achievements":
            navigateFromNotification("Achievements", {
              highlightId: raw.achievementId,
            });
            break;
          case "Notifications":
            navigateFromNotification("Notifications", undefined);
            break;
        }
      },
    );

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [isAuthenticated, queryClient]);
}

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
