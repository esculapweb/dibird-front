import { useState, useEffect, ReactNode, useRef } from "react";
import "react-native-gesture-handler";
import "react-native-reanimated";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Navigation from "./navigation/Navigation";
import Toast from "react-native-toast-message";
import "./services/i18n";
import { QueryClientProvider } from "@tanstack/react-query";
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
import { AlertSettingsProvider } from "./store/alert-settings-context";
import { OnboardingProvider } from "./store/onboarding-context";
import { FiltersProvider } from "./store/filters-context";
import { LocationProvider } from "./store/location-context";
import { LanguageProvider } from "./store/language-context";
import { ThemeProvider, useTheme } from "./store/theme-context";
import ThemedToast from "./components/ui/ThemedToast";
import { initGoogleSignIn } from "./util/auth";
import { runMigrations } from "./services/db/client";
import GlobalBottomSheet from "./components/Providers/GlobalBottomSheet";
import CustomSplash from "./components/ui/CustomSplash";
import { initSentry } from "./services/sentry";
import { usePushNotifications } from "./hooks/usePushNotifications";
import { useLocation } from "./store/location-context";
import { useLanguage } from "./store/language-context";
import { useAlertSettings } from "./store/alert-settings-context";
import type { AlertSettingsPatch } from "./services/alertSettings";
import { queryClient } from "./services/queryClient";
import { restoreQueryCache, startPersistingQueryCache } from "./services/queryPersist";
import { useObservationSync } from "./hooks/Observation/useObservationSync";
import { useDiarySync } from "./hooks/Diary/useDiarySync";
import { usePlaceSync } from "./hooks/Place/usePlaceSync";
import { useNotificationSync } from "./hooks/Notification/useNotificationSync";
import { useSpeciesImagePrefetch } from "./hooks/useSpeciesImagePrefetch";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
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
    await runMigrations();
  } catch (e) {
    Sentry.captureException(e, {
      tags: { context: "db-migrations" },
    });
    throw e;
  }

  try {
    // Hydrates the React Query cache from the previous session before the
    // splash screen hides, so the first-mounted screen paints from
    // last-known data instead of an empty cache — see services/queryPersist.ts.
    await restoreQueryCache();
  } catch (e) {
    Sentry.captureException(e, {
      tags: { context: "query-cache-restore" },
      level: "warning",
    });
  }
  startPersistingQueryCache();

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

const AuthConsumerWrapper = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isInitializing } = useAuth();
  return (
    <ProfileProvider
      isAuthenticated={isAuthenticated}
      isInitializing={isInitializing}
    >
      <AlertSettingsProvider
        isAuthenticated={isAuthenticated}
        isInitializing={isInitializing}
      >
        <OnboardingProvider
          isAuthenticated={isAuthenticated}
          isInitializing={isInitializing}
        >
          {children}
        </OnboardingProvider>
      </AlertSettingsProvider>
    </ProfileProvider>
  );
};

const Root = () => {
  const { theme } = useTheme();
  const [splashFinished, setSplashFinished] = useState(false);
  const { isAuthenticated } = useAuth();
  const { locationCoords, requestLocation } = useLocation();
  const { language } = useLanguage();
  const { save } = useAlertSettings();
  const didAutoSave = useRef(false);


  usePushNotifications(isAuthenticated);
  useObservationSync(isAuthenticated);
  useDiarySync(isAuthenticated);
  usePlaceSync(isAuthenticated);
  useNotificationSync(isAuthenticated);
  useSpeciesImagePrefetch(isAuthenticated);

  // Молча: вход в аккаунт — не повод для системного диалога о геопозиции. У
  // тех, кто разрешение уже дал, ничего не меняется (диалога и так не было), а
  // у новой установки он всплывёт там, где в нём появляется смысл — на карточке
  // алертов, в редакторе места, при сортировке по расстоянию. Координаты нужны
  // эффекту ниже (lat/lon в настройках алертов), но сами по себе поводом не
  // являются.
  useEffect(() => {
    if (!isAuthenticated) {
      didAutoSave.current = false;
      return;
    }
    requestLocation(undefined, { prompt: false });
  }, [isAuthenticated]);

  useEffect(() => {
    if (!locationCoords || !language || !isAuthenticated) return;
    if (didAutoSave.current) return;
    didAutoSave.current = true;
    save({
      lat: Math.round(locationCoords[1] * 100) / 100,
      lon: Math.round(locationCoords[0] * 100) / 100,
      language,
    } satisfies AlertSettingsPatch);
  }, [locationCoords, language, isAuthenticated]);

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
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      <Navigation />
      <Toast config={ThemedToast} position="bottom" />
      <GlobalBottomSheet />
    </>
  );
};

const AppContent = () => {
  const { Colors } = useTheme();

  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: Colors.backgroundMain }}
    >
      <AuthConsumerWrapper>
        <FiltersProvider>
          <LocationProvider>
            <BottomSheetModalProvider>
              <Root />
            </BottomSheetModalProvider>
          </LocationProvider>
        </FiltersProvider>
      </AuthConsumerWrapper>
    </GestureHandlerRootView>
  );
};

export default Sentry.wrap(function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <ThemeProvider>
            <AuthContextProvider>
              <AppContent />
            </AuthContextProvider>
          </ThemeProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
});
