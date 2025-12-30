import { useContext, useState } from "react";
import { Alert } from "react-native";

import { AuthContext } from "../store/auth-context";
import AuthContent from "../components/Auth/AuthContent";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import { Login } from "../util/auth";

const LoginScreen = () => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const authCtx = useContext(AuthContext);

  const LoginHandler = async ({ email, password }) => {
    setIsAuthenticating(true);
    try {
      const token = await Login(email, password);
      authCtx.authenticate(token);
    } catch (error) {
      Alert.alert(
        "Authentication failed",
        error.response?.data?.error?.message ||
          "Could not log you in. Please check your credentials or try again later."
      );
      setIsAuthenticating(false);
    }
  };

  if (isAuthenticating) return <LoadingOverlay message="Logging you in.." />;

  return <AuthContent onAuthenticate={LoginHandler} isLogin />;
};

export default LoginScreen;
