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
      Alert.alert(t("email_confirmation"), t("check_email"));
      navigation.navigate("Login");
    } catch (e) {
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return <AuthContent onAuthenticate={signUpHandler} loading={loading} />;
};

export default SignupScreen;
