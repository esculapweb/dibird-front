import { useContext, useState } from "react";

import { AuthContext } from "../store/auth-context";
import AuthContent from "../components/Auth/AuthContent";
import { Login } from "../util/auth";
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
      await authCtx.authenticate(token);
      await profileCtx.refreshProfile();
    } catch (e) {
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContent onAuthenticate={LoginHandler} loading={loading} isLogin />
  );
};

export default LoginScreen;
