import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect, useRef } from "react";
import { InitialState } from "@react-navigation/native";
import { NavigationContainer } from "@react-navigation/native";

import { track } from "../services/analytics";
import { useAuth } from "../store/auth-context";
import AuthNavigator from "./AuthStack";
import AppNavigator from "./AppStack";
import { useTheme } from "../store/theme-context";
import {
  LightNavigationTheme,
  DarkNavigationTheme,
} from "../constants/NavigationTheme";
import linking from "../linking";
import { navigationIntegration } from "../services/sentry";
import {
  flushPendingNavigation,
  navigationRef,
} from "../services/navigationRef";
import type { MinimalRoute, NavState } from "../types";

const NAV_STATE_KEY = "NAV_STATE";

const extractRoutes = (state: NavState, depth = 0): MinimalRoute[] => {
  if (depth > 10) return [];
  const routes = state?.routes ?? [];
  const index = state?.index ?? routes.length - 1;
  const activeRoute = routes[index];

  if (!activeRoute) return [];

  if (activeRoute.state) {
    const nested = activeRoute.state;
    const nestedRoutes = nested?.routes ?? [];
    const isDrawer = nestedRoutes.every(
      (r) => !r.state && r.name === "MainScreen",
    );

    if (isDrawer) {
      return [{ name: activeRoute.name }];
    }

    return [
      { name: activeRoute.name },
      ...extractRoutes(activeRoute.state, depth + 1),
    ];
  }

  return [{ name: activeRoute.name, params: activeRoute.params }];
};

const AUTH_SCREENS = new Set(["Login", "Signup", "CheckEmail", "ConfirmEmail"]);

const buildInitialState = (routes: MinimalRoute[]): InitialState | null => {
  const screenRoutes =
    routes[0]?.name === "Root" || routes[0]?.name === "Main"
      ? routes.slice(1)
      : routes;

  const innerRoutes = screenRoutes.map((r) => ({
    name: r.name,
    params: r.params,
  }));

  const root = innerRoutes.some((r) => AUTH_SCREENS.has(r.name))
    ? "Welcome"
    : "Main";

  const allRoutes = [{ name: root }, ...innerRoutes];

  return {
    index: allRoutes.length - 1,
    routes: allRoutes,
  };
};

const Navigation = () => {
  const { theme } = useTheme();
  const { isAuthenticated } = useAuth();
  const routeNameRef = useRef<string | undefined>(undefined);
  const prevAuthRef = useRef<boolean | null>(null);

  const [initialState, setInitialState] = useState<
    InitialState | null | undefined
  >(undefined);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const restore = async () => {
      try {
        const saved = await AsyncStorage.getItem(NAV_STATE_KEY);

        if (!saved) {
          setInitialState(null);
          return;
        }

        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          const built = buildInitialState(parsed);
          setInitialState(built ?? null);
          return;
        }

        await AsyncStorage.removeItem(NAV_STATE_KEY);
        setInitialState(null);
      } catch {
        setInitialState(null);
      }
    };

    restore();
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (prevAuthRef.current === null) {
      prevAuthRef.current = isAuthenticated;
      return;
    }
    if (prevAuthRef.current !== isAuthenticated) {
      prevAuthRef.current = isAuthenticated;
      AsyncStorage.removeItem(NAV_STATE_KEY);
    }
  }, [isAuthenticated]);

  if (initialState === undefined) return null;

  return (
    <NavigationContainer
      ref={navigationRef}
      initialState={initialState ?? undefined}
      linking={linking(isAuthenticated)}
      theme={theme === "dark" ? DarkNavigationTheme : LightNavigationTheme}
      onReady={() => {
        flushPendingNavigation();

        navigationIntegration.registerNavigationContainer(navigationRef);
        const current = navigationRef.current?.getCurrentRoute()?.name;

        routeNameRef.current = current;

        if (current) {
          track("screen_view", {
            screen_name: current,
            screen_class: current,
          });
        }
      }}
      onStateChange={async (state) => {
        if (state) {
          const routes = extractRoutes(state as NavState);
          if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = setTimeout(() => {
            AsyncStorage.setItem(NAV_STATE_KEY, JSON.stringify(routes)).catch(
              (e) => __DEV__ && console.warn("[NAV] failed to save state", e),
            );
          }, 300);
        }

        const current = navigationRef.current?.getCurrentRoute()?.name;
        const previous = routeNameRef.current;

        if (current && previous !== current) {
          track("screen_view", {
            screen_name: current,
            screen_class: current,
          });
          routeNameRef.current = current;
        }
      }}
    >
      {isAuthenticated ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

export default Navigation;
