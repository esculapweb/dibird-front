import * as SecureStore from "expo-secure-store";
import { createContext, useState, useEffect } from "react";

import { setOnTokenUpdate } from "../services/authService";

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

  const authenticate = async (token) => {
    setAuthToken(token);
    await SecureStore.setItemAsync("token", token);
  };

  const logout = async () => {
    setAuthToken();
    await SecureStore.deleteItemAsync("token");
  };

  useEffect(() => {
    const restoreToken = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync("token");
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
