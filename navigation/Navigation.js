import { useContext, useRef } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { getAnalytics, logEvent } from "@react-native-firebase/analytics";

import { AuthContext } from "../store/auth-context";
import AuthDrawer from "./AuthStack";
import AppNavigator from "./AppStack";
import { useTheme } from "../store/theme-context";
import {
  LightNavigationTheme,
  DarkNavigationTheme,
} from "../constants/NavigationTheme";
import linking from "../linking";

const Navigation = () => {
  const { theme } = useTheme();
  const { isAuthenticated } = useContext(AuthContext);
  const navigationRef = useRef();
  const routeNameRef = useRef();

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking(isAuthenticated)}
      theme={theme === "dark" ? DarkNavigationTheme : LightNavigationTheme}
      onReady={() => {
        routeNameRef.current = navigationRef.current.getCurrentRoute().name;
      }}
      onStateChange={async () => {
        const previous = routeNameRef.current;
        const current = navigationRef.current.getCurrentRoute().name;
        if (previous !== current) {
          logEvent(getAnalytics(), "screen_view", {
            screen_name: current,
            screen_class: current,
          });
          routeNameRef.current = current;
        }
      }}
    >
      {isAuthenticated ? <AppNavigator /> : <AuthDrawer />}
    </NavigationContainer>
  );
};

export default Navigation;
