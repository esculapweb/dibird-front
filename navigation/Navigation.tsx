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
import type { AuthRootParamList, AppRootParamList } from "../types";

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

  // Один раз при старте восстанавливаем сохранённый стейт
  useEffect(() => {
    AsyncStorage.getItem(NAV_STATE_KEY)
      .then((saved) =>
        setInitialState(saved ? (JSON.parse(saved) as InitialState) : null),
      )
      .catch(() => setInitialState(null));
  }, []);

  // При смене isAuthenticated — сбрасываем стейт и навигацию
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
        if (state) AsyncStorage.setItem(NAV_STATE_KEY, JSON.stringify(state));
        const previous = routeNameRef.current;
        const current = navigationRef.current?.getCurrentRoute()?.name;
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
