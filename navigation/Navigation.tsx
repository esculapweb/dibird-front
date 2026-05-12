import { useRef } from "react";
import {
  NavigationContainer,
  NavigationContainerRef,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { getAnalytics, logEvent } from "@react-native-firebase/analytics";
import { useTranslation } from "react-i18next";

import { useAuth } from "../store/auth-context";
import AuthDrawer from "./AuthStack";
import AppNavigator from "./AppStack";
import { useTheme } from "../store/theme-context";
import {
  LightNavigationTheme,
  DarkNavigationTheme,
} from "../constants/NavigationTheme";
import linking from "../linking";
import StaticScreen from "../screens/StaticScreen";
import type { AuthRootParamList, AppRootParamList } from "../types";

const AuthStack = createNativeStackNavigator<AuthRootParamList>();
const AppStack = createNativeStackNavigator<AppRootParamList>();

const AuthNavigator = () => {
  const { t } = useTranslation();
  return (
    <AuthStack.Navigator
      id={undefined}
      screenOptions={{
        headerShown: false,
        headerBackButtonDisplayMode: "minimal",
        headerBackTitle: "",
      }}
    >
      <AuthStack.Screen name="Root" component={AuthDrawer} />
      <AuthStack.Screen
        name="Privacy"
        component={StaticScreen}
        options={{ headerShown: true, title: t("privacy_policy") }}
      />
      <AuthStack.Screen
        name="Terms"
        component={StaticScreen}
        options={{ headerShown: true, title: t("terms_of_service") }}
      />
    </AuthStack.Navigator>
  );
};

const AppNavigatorWithStatic = () => {
  const { t } = useTranslation();
  return (
    <AppStack.Navigator
      id={undefined}
      screenOptions={{
        headerShown: false,
        headerBackButtonDisplayMode: "minimal",
        headerBackTitle: "",
      }}
    >
      <AppStack.Screen name="Root" component={AppNavigator} />
      <AppStack.Screen
        name="Privacy"
        component={StaticScreen}
        options={{ headerShown: true, title: t("privacy_policy") }}
      />
      <AppStack.Screen
        name="Terms"
        component={StaticScreen}
        options={{ headerShown: true, title: t("terms_of_service") }}
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

  return (
    <NavigationContainer
      key={isAuthenticated ? "app" : "auth"}
      ref={navigationRef}
      linking={linking(isAuthenticated)}
      theme={theme === "dark" ? DarkNavigationTheme : LightNavigationTheme}
      onReady={() => {
        routeNameRef.current = navigationRef.current?.getCurrentRoute()?.name;
      }}
      onStateChange={async () => {
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
      {isAuthenticated ? <AppNavigatorWithStatic /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

export default Navigation;
