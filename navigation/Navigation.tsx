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

const RootStack = createNativeStackNavigator();

const Navigation = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { isAuthenticated } = useAuth();
  const navigationRef =
    useRef<NavigationContainerRef<ReactNavigation.RootParamList>>(null);
  const routeNameRef = useRef<string | undefined>(undefined);

  return (
    <NavigationContainer
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
      <RootStack.Navigator
        id={undefined}
        screenOptions={{
          headerShown: false,
          headerBackButtonDisplayMode: "minimal",
          headerBackTitle: "",
        }}
      >
        <RootStack.Screen
          name="Root"
          component={isAuthenticated ? AppNavigator : AuthDrawer}
        />
        <RootStack.Screen
          name="Privacy"
          component={StaticScreen}
          options={{
            headerShown: true,
            title: t("privacy_policy"),
          }}
        />
        <RootStack.Screen
          name="Terms"
          component={StaticScreen}
          options={{
            headerShown: true,
            title: t("terms_of_service"),
          }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

export default Navigation;
