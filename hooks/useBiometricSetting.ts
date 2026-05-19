import { useState, useEffect, useCallback } from "react";
import * as SecureStore from "expo-secure-store";

const BIOMETRIC_KEY = "biometric_enabled";

export const useBiometricSetting = () => {
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    SecureStore.getItemAsync(BIOMETRIC_KEY).then((val) => {
      setIsEnabled(val === "true");
      setIsLoading(false);
    });
  }, []);

  const toggle = useCallback(async (value: boolean) => {
    setIsEnabled(value);
    await SecureStore.setItemAsync(BIOMETRIC_KEY, String(value));
  }, []);

  return { isEnabled, isLoading, toggle };
};
