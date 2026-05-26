import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect, useRef } from "react";
import { InitialState } from "@react-navigation/native";
import {
  NavigationContainer,
  NavigationContainerRef,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { getAnalytics, logEvent } from "@react-native-firebase/analytics";
import { useTranslation } from "react-i18next";

import { useAuth } from "../store/auth-context";
import AuthNavigator from "./AuthStack";
import AppNavigator from "./AppStack";
import { useTheme } from "../store/theme-context";
import {
  LightNavigationTheme,
  DarkNavigationTheme,
} from "../constants/NavigationTheme";
import linking from "../linking";
import StaticScreen from "../screens/StaticScreen";
import type {
  AuthRootParamList,
  AppRootParamList,
  MinimalRoute,
  NavState,
} from "../types";

const NAV_STATE_KEY = "NAV_STATE";

const AuthStack = createNativeStackNavigator<AuthRootParamList>();
const AppStack = createNativeStackNavigator<AppRootParamList>();

const AuthRoot = () => {
  const { t } = useTranslation();
  return (
    <AuthStack.Navigator
      id={undefined}
      screenOptions={{
        headerBackButtonDisplayMode: "minimal",
        headerBackTitle: "",
      }}
    >
      <AuthStack.Screen
        name="Root"
        component={AuthNavigator}
        options={{ headerShown: false }}
      />
      <AuthStack.Screen
        name="Privacy"
        component={StaticScreen}
        options={{ title: t("privacy_policy") }}
      />
      <AuthStack.Screen
        name="Terms"
        component={StaticScreen}
        options={{ title: t("terms_of_service") }}
      />
    </AuthStack.Navigator>
  );
};

const AppRoot = () => {
  const { t } = useTranslation();
  return (
    <AppStack.Navigator
      id={undefined}
      screenOptions={{
        headerBackButtonDisplayMode: "minimal",
        headerBackTitle: "",
      }}
    >
      <AppStack.Screen
        name="Root"
        component={AppNavigator}
        options={{ headerShown: false }}
      />
      <AppStack.Screen
        name="Privacy"
        component={StaticScreen}
        options={{ title: t("privacy_policy") }}
      />
      <AppStack.Screen
        name="Terms"
        component={StaticScreen}
        options={{ title: t("terms_of_service") }}
      />
    </AppStack.Navigator>
  );
};

const extractRoutes = (state: NavState): MinimalRoute[] => {
  const routes = state?.routes ?? [];
  const index = state?.index ?? routes.length - 1;
  const activeRoute = routes[index];

  if (!activeRoute) return [];

  if (activeRoute.state) {
    return [{ name: activeRoute.name }, ...extractRoutes(activeRoute.state)];
  }

  return [{ name: activeRoute.name, params: activeRoute.params }];
};

const buildInitialState = (routes: MinimalRoute[]): InitialState => {
  const screenRoutes =
    routes[0]?.name === "Root" || routes[0]?.name === "Main"
      ? routes.slice(1)
      : routes;

  const innerRoutes = screenRoutes.map((r) => ({
    name: r.name,
    params: r.params,
  }));

  return {
    routes: [
      {
        name: "Root",
        state: {
          index: innerRoutes.length,
          routes: [{ name: "Main" }, ...innerRoutes],
        },
      },
    ],
  };
};

const Navigation = () => {
  const { theme } = useTheme();
  const { isAuthenticated } = useAuth();
  const navigationRef =
    useRef<NavigationContainerRef<ReactNavigation.RootParamList>>(null);
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
          setInitialState(buildInitialState(parsed));
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
      navigationRef.current?.reset({ index: 0, routes: [{ name: "Root" }] });
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
        routeNameRef.current = navigationRef.current?.getCurrentRoute()?.name;
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

        if (previous !== current) {
          logEvent(getAnalytics(), "screen_view", {
            screen_name: current,
            screen_class: current,
          });
          routeNameRef.current = current;
        }
      }}
    >
      {isAuthenticated ? <AppRoot /> : <AuthRoot />}
    </NavigationContainer>
  );
};

export default Navigation;
