import { useContext, useState } from "react";
import { Alert } from "react-native";

import { AuthContext } from "../store/auth-context";
import AuthContent from "../components/Auth/AuthContent";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import { CreateUser } from "../util/auth";

const SignupScreen = () => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const authCtx = useContext(AuthContext);

  const signUpHandler = async ({ email, password }) => {
    setIsAuthenticating(true);
    try {
      const token = await CreateUser(email, password);
      authCtx.authenticate(token);
    } catch (error) {
      Alert.alert(
        "Authentication failed",
        error.response?.data?.error?.message ||
          "Could not create user. Please check your input or try again later."
      );
      setIsAuthenticating(false);
    }
  };

  if (isAuthenticating) return <LoadingOverlay message="Creating user..." />;

  return <AuthContent onAuthenticate={signUpHandler} />;
};

export default SignupScreen;
