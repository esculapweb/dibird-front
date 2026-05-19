import {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  ReactNode,
} from "react";
import * as LocalAuthentication from "expo-local-authentication";

import { setOnTokenUpdate } from "../services/authService";
import { Logout } from "../util/auth";
import { setOnUnauthorized, saveTokens, getAccessToken } from "../services/api";
import i18n from "../services/i18n";
import { shouldUseBiometrics } from "../services/bio";

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

export const AuthContextProvider = ({ children }: { children: ReactNode }) => {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const authenticate = useCallback(async (access: string | null) => {
    setAuthToken(access);
    if (access) await saveTokens({ access });
  }, []);

  const logout = useCallback(async () => {
    await Logout(() => {
      setAuthToken(null);
      onLogoutCallback?.();
    });
  }, []);

  useEffect(() => {
    const restoreToken = async () => {
      try {
        if (await shouldUseBiometrics()) {
          const res = await LocalAuthentication.authenticateAsync({
            promptMessage: i18n.t("unlock_message"),
            fallbackLabel: i18n.t("unlock_fallback"),
          });
          if (!res.success) {
            return;
          }
        }
        const storedToken = await getAccessToken();
        if (storedToken) setAuthToken(storedToken);
      } catch (e) {
        console.warn("SecureStore unavailable on restore:", e);
      } finally {
        setIsInitializing(false);
      }
    };

    restoreToken();
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
