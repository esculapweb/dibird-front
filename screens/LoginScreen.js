import { useContext, useState } from "react";
import Toast from "react-native-toast-message";

import { AuthContext } from "../store/auth-context";
import AuthContent from "../components/Auth/AuthContent";
import { Login } from "../util/auth";
import api from "../services/api";
import { useProfile } from "../store/profile-context";

const LoginScreen = () => {
  const [loading, setLoading] = useState(false);
  const authCtx = useContext(AuthContext);
  const profileCtx = useProfile();

  const LoginHandler = async ({ email, password }) => {
    if (loading) return;

    setLoading(true);
    try {
      const token = await Login(email, password);
      authCtx.authenticate(token);
      profileCtx.refreshProfile();
    } catch (error) {
      const message =
        error.response?.data?.non_field_errors?.[0] ||
        error.response?.data?.email?.[0] ||
        error.response?.data?.password?.[0] ||
        Object.values(data || {})
          .flat()
          .join("\n") ||
        "Could not log you in. Please check your credentials or try again later.";

      Toast.show({
        type: "error",
        text1: "Authentication failed",
        text2: message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContent onAuthenticate={LoginHandler} loading={loading} isLogin />
  );
};

export default LoginScreen;
