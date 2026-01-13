import { useContext, useState } from "react";
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";

import { AuthContext } from "../store/auth-context";
import AuthContent from "../components/Auth/AuthContent";
import { Login } from "../util/auth";
import { useProfile } from "../store/profile-context";

const LoginScreen = () => {
  const [loading, setLoading] = useState(false);
  const authCtx = useContext(AuthContext);
  const profileCtx = useProfile();
  const { t } = useTranslation();

  const LoginHandler = async ({ email, password }) => {
    if (loading) return;

    setLoading(true);
    try {
      const token = await Login(email, password);
      await authCtx.authenticate(token);
      profileCtx.refreshProfile();
    } catch (error) {
      const message =
        error.response?.data?.non_field_errors?.[0] ||
        error.response?.data?.email?.[0] ||
        error.response?.data?.password?.[0] ||
        Object.values(data || {})
          .flat()
          .join("\n") ||
        t("could_not_login");

      Toast.show({
        type: "error",
        text1: t("authentication_failed"),
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
