import { StatusBar } from "expo-status-bar";
import { useEffect, useContext } from "react";
import * as SplashScreen from "expo-splash-screen";
import AuthContextProvider, { AuthContext } from "./store/auth-context";
import Toast from "react-native-toast-message";

import Navigation from "./navigation/Navigation";


SplashScreen.preventAutoHideAsync();


const Root = () => {
  const { isInitializing } = useContext(AuthContext);

  useEffect(() => {
    if (!isInitializing) {
      SplashScreen.hide();
    }
  }, [isInitializing]);

  if (isInitializing) {
    return null;
  }

  return <Navigation />;
};

export default function App() {
  return (
    <>
      <StatusBar style="light" />
      <AuthContextProvider>
        <Root />
        <Toast />
      </AuthContextProvider>
    </>
  );
}
