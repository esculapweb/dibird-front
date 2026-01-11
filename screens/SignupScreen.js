import { useState } from "react";
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";

import AuthContent from "../components/Auth/AuthContent";
import { CreateUser } from "../util/auth";

const SignupScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  const signUpHandler = async ({ email, password, userName }) => {
    if (loading) return;

    setLoading(true);
    try {
      await CreateUser(email, password, userName);
      Alert.alert(
        t("email_confirmation"),
        t("check_email")
      );
      navigation.replace("Login");
    } catch (error) {
      const message =
        error.response?.data?.non_field_errors?.[0] ||
        error.response?.data?.email?.[0] ||
        error.response?.data?.username?.[0] ||
        error.response?.data?.password1?.[0] ||
        error.response?.data?.password2?.[0] ||
        Object.values(data || {})
          .flat()
          .join("\n") ||
        t("could_not_signup");

      Alert.alert(t("could_not_create_user"), message);
    } finally {
      setLoading(false);
    }
  };

  return <AuthContent onAuthenticate={signUpHandler} loading={loading} />;
};

export default SignupScreen;
