import * as SecureStore from "expo-secure-store";
import { createContext, useState, useEffect } from "react";
import * as LocalAuthentication from "expo-local-authentication";
import { useTranslation } from "react-i18next";

import { setOnTokenUpdate } from "../services/authService";
import { canUseBiometrics } from "../services/bio";

export const AuthContext = createContext({
  token: "",
  isAuthenticated: false,
  isInitializing: true,
  authenticate: () => {},
  logout: () => {},
});

const AuthContextProvider = ({ children }) => {
  const [authToken, setAuthToken] = useState();
  const [isInitializing, setIsInitializing] = useState(true);
  const { t } = useTranslation();

  const authenticate = async (access) => {
    setAuthToken(access);
    if (access) await SecureStore.setItemAsync("access", access);
  };

  const logout = async () => {
    setAuthToken(null);
    await SecureStore.deleteItemAsync("access");
    await SecureStore.deleteItemAsync("refresh");
    await AsyncStorage.removeItem("profile");
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
      if (!await canUseBiometrics()) return;

      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: t("unlock_message"),
        fallbackLabel: t("unlock_fallback"),
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
