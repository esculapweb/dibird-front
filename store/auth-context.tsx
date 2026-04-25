import * as SecureStore from "expo-secure-store";
import { createContext, useState, useEffect, useContext } from "react";
import * as LocalAuthentication from "expo-local-authentication";

import { setOnTokenUpdate } from "../services/authService";
import { canUseBiometrics } from "../services/bio";
import { Logout } from "../util/auth";
import i18n from "../services/i18n";
import { setOnUnauthorized } from "../services/api";

interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  authenticate: (access: string | null) => Promise<void>;
  logout: () => Promise<void>;
}

let onLogoutCallback: (() => void) | null = null;

export const setOnLogout = (fn: (() => void) | null) => {
  onLogoutCallback = fn;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const authenticate = async (access: string | null) => {
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

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context)
    throw new Error("AuthContext must be used within AuthContextProvider");
  return context;
};
