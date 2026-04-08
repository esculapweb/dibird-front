import * as SecureStore from "expo-secure-store";
import { createContext, useState, useEffect } from "react";
import * as LocalAuthentication from "expo-local-authentication";

import { setOnTokenUpdate } from "../services/authService";
import { canUseBiometrics } from "../services/bio";
import { Logout } from "../util/auth";
import i18n from "../services/i18n";
import { setOnUnauthorized } from "../services/api";

let onLogoutCallback = null;

export const setOnLogout = (fn) => {
  onLogoutCallback = fn;
};

export const AuthContext = createContext({
  token: "",
  isAuthenticated: false,
  isInitializing: true,
  authenticate: async (access) => {},
  logout: async () => {},
});

const AuthContextProvider = ({ children }) => {
  const [authToken, setAuthToken] = useState();
  const [isInitializing, setIsInitializing] = useState(true);

  const authenticate = async (access) => {
    setAuthToken(access);
    if (access) await SecureStore.setItemAsync("access", access);
  };

  const logout = async () => {
    await Logout(() => {
      setAuthToken(null);
      onLogoutCallback?.();
    });
  };

  useEffect(() => {
    const restoreToken = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync("access");
        if (storedToken) {
          setAuthToken(storedToken);
        }
      } finally {
        setIsInitializing(false);
      }
    };

    restoreToken();
  }, []);

  useEffect(() => {
    const unlockApp = async () => {
      if (!(await canUseBiometrics())) return;

      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: i18n.t("unlock_message"),
        fallbackLabel: i18n.t("unlock_fallback"),
      });

      if (!res.success) {
        logout();
      }
    };

    unlockApp();
  }, []);

  useEffect(() => {
    setOnTokenUpdate(authenticate);
  }, []);

  useEffect(() => {
    setOnUnauthorized(logout);
    return () => setOnUnauthorized(null);
  }, [logout]);

  const value = {
    token: authToken,
    isAuthenticated: !!authToken,
    isInitializing,
    authenticate: authenticate,
    logout: logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContextProvider;
