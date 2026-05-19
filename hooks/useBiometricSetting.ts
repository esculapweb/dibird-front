import { useState, useEffect, useCallback } from "react";
import * as SecureStore from "expo-secure-store";

const BIOMETRIC_KEY = "biometric_enabled";

const STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export const useBiometricSetting = () => {
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    SecureStore.getItemAsync(BIOMETRIC_KEY, STORE_OPTIONS).then((val) => {
      setIsEnabled(val === "true");
      setIsLoading(false);
    });
  }, []);

  const toggle = useCallback(async (value: boolean) => {
    setIsEnabled(value);
    await SecureStore.setItemAsync(BIOMETRIC_KEY, String(value), STORE_OPTIONS);
  }, []);

  return { isEnabled, isLoading, toggle };
};
