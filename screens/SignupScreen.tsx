import { useState } from "react";
import { useNavigation } from "@react-navigation/native";

import AuthContent from "../components/Auth/AuthContent";
import { CreateUser } from "../util/auth";
import { AuthStackNavigationProp, Credentials } from "../types";

const SignupScreen = () => {
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<AuthStackNavigationProp>();

  const signUpHandler = async ({ email, password, userName }: Credentials) => {
    if (loading) return;

    setLoading(true);
    try {
      if (!userName) return;
      await CreateUser(email, password, userName);
      navigation.popToTop();
      navigation.navigate("CheckEmail", { email });
    } catch (e) {
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return <AuthContent onAuthenticate={signUpHandler} loading={loading} />;
};

export default SignupScreen;
