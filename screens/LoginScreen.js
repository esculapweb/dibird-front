import { useContext, useState } from "react";

import { AuthContext } from "../store/auth-context";
import AuthContent from "../components/Auth/AuthContent";
import { Login } from "../util/auth";
import { useProfile } from "../store/profile-context";
import { useFilters } from "../store/filters-context";

const LoginScreen = () => {
  const [loading, setLoading] = useState(false);
  const { authenticate } = useContext(AuthContext);
  const { refreshProfile } = useProfile();
  const { reload } = useFilters();

  const LoginHandler = async ({ email, password }) => {
    if (loading) return;

    setLoading(true);
    try {
      const token = await Login(email, password);
      await authenticate(token);
      await refreshProfile();
      await reload(); 
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
