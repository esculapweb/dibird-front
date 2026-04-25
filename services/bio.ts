import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export const canUseBiometrics = async () => {
  if (
    Platform.OS === "ios" &&
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  )
    return false;
  return SecureStore.canUseBiometricAuthentication();
};
