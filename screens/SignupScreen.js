import { useContext, useState } from "react";
import { Alert } from "react-native";

import { AuthContext } from "../store/auth-context";
import AuthContent from "../components/Auth/AuthContent";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import { CreateUser } from "../util/auth";

const SignupScreen = ({ navigation }) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const authCtx = useContext(AuthContext);

  const signUpHandler = async ({ email, password, userName }) => {
    setIsAuthenticating(true);
    try {
      await CreateUser(email, password, userName);
      Alert.alert(
        "Email confirmation",
        "Please check your email to finish registration"
      );
      navigation.replace("Login");
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
