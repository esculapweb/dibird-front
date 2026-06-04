import {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  ReactNode,
} from "react";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

import { setOnTokenUpdate } from "../services/authService";
import { Logout } from "../util/auth";
import { setOnUnauthorized } from "../services/api";
import i18n from "../services/i18n";
import { shouldUseBiometrics } from "../services/bio";
import { unregisterPushToken } from "../util/fetches";

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
    if (access) await SecureStore.setItemAsync("access", access);
  }, []);

  const logout = useCallback(async () => {
    try {
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });
      await unregisterPushToken(token.data);
    } catch (e) {
      if (__DEV__) console.warn("unregister push token failed", e);
    }

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
        const storedToken = await SecureStore.getItemAsync("access");
        if (storedToken) setAuthToken(storedToken);
      } catch (e) {
        if (__DEV__) console.warn("SecureStore unavailable on restore:", e);
      } finally {
        setIsInitializing(false);
      }
    };

    restoreToken();
  }, []);

  useEffect(() => {
    setOnTokenUpdate(authenticate);
  }, [authenticate]);

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
