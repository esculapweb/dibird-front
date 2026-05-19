import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const BIOMETRIC_KEY = "biometric_enabled";

const STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export const canUseBiometrics = async () => {
  if (
    Platform.OS === "ios" &&
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  )
    return false;
  return SecureStore.canUseBiometricAuthentication();
};

export const shouldUseBiometrics = async () => {
  const hardwareOk = await canUseBiometrics();
  if (!hardwareOk) return false;
  const stored = await SecureStore.getItemAsync(BIOMETRIC_KEY, STORE_OPTIONS);
  return stored === "true";
};