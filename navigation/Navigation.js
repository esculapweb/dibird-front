import { useContext } from "react";
import { NavigationContainer } from "@react-navigation/native";

import { AuthContext } from "../store/auth-context";
import AuthDrawer from "./AuthStack";
import AppDrawer from "./AppStack";

const Navigation = () => {
  const authCtx = useContext(AuthContext);
  return (
    <NavigationContainer>
      {authCtx.isAuthenticated ? <AppDrawer /> : <AuthDrawer />}
    </NavigationContainer>
  );
};

export default Navigation;
