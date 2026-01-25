import { useContext } from "react";
import { NavigationContainer } from "@react-navigation/native";

import { AuthContext } from "../store/auth-context";
import AuthDrawer from "./AuthStack";
import AppDrawer from "./AppStack";
import { useTheme } from "../store/theme-context";
import {
  LightNavigationTheme,
  DarkNavigationTheme,
} from "../constants/NavigationTheme";

const Navigation = () => {
  const { theme } = useTheme();
  const authCtx = useContext(AuthContext);

  return (
    <NavigationContainer
      theme={theme === "dark" ? DarkNavigationTheme : LightNavigationTheme}
    >
      {authCtx.isAuthenticated ? <AppDrawer /> : <AuthDrawer />}
    </NavigationContainer>
  );
};

export default Navigation;
