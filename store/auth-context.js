import * as SecureStore from "expo-secure-store";

import { createContext, useState } from "react";

export const AuthContext = createContext({
  token: "",
  isAuthenticated: false,
  authenticate: () => {},
  logout: () => {},
});

const AuthContextProvider = ({ children }) => {
  const [authToken, setAuthToken] = useState();

  const authenticate = async (token) => {
    setAuthToken(token);
    await SecureStore.setItemAsync("token", token);
  };

  const logout = async () => {
    setAuthToken();
    await SecureStore.deleteItemAsync("token");
  };

  const value = {
    token: authToken,
    isAuthenticated: !!authToken,
    authenticate: authenticate,
    logout: logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContextProvider;
