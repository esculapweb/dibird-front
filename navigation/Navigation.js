import { useContext } from "react";
import { NavigationContainer } from "@react-navigation/native";

import { AuthContext } from "../store/auth-context";
import AuthStack from "./AuthStack";
import AppStack from "./AppStack";

const Navigation = () => {
  const authCtx = useContext(AuthContext);
  return (
    <NavigationContainer>
      {authCtx.isAuthenticated ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
};

export default Navigation;
