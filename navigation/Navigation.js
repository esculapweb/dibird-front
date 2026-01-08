import { useContext } from "react";
import { NavigationContainer } from "@react-navigation/native";

import { AuthContext } from "../store/auth-context";
import AuthStack from "./AuthStack";
import AppDrawer from "./AppStack";

const Navigation = () => {
  const authCtx = useContext(AuthContext);
  return (
    <NavigationContainer>
      {authCtx.isAuthenticated ? <AppDrawer /> : <AuthStack />}
    </NavigationContainer>
  );
};

export default Navigation;
