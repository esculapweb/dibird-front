import { useState } from "react";
import { useRoute } from "@react-navigation/native";

import { useAuth } from "../store/auth-context";
import AuthContent from "../components/Auth/AuthContent";
import { Login } from "../util/auth";
import { AuthStackRouteProp } from "../types";

const LoginScreen = () => {
  const [loading, setLoading] = useState(false);
  const { authenticate } = useAuth();
  const route = useRoute<AuthStackRouteProp<"Login">>();

  const emailConfirmed = route.params?.emailConfirmed;
  const prefillEmail = route.params?.prefillEmail;

  const LoginHandler = async ({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) => {
    if (loading) return;

    setLoading(true);
    try {
      const token = await Login(email, password);
      await authenticate(token);
    } catch (e) {
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContent
      onAuthenticate={LoginHandler}
      loading={loading}
      emailConfirmed={emailConfirmed}
      prefillEmail={prefillEmail}
      isLogin
    />
  );
};

export default LoginScreen;
