import * as LocalAuthentication from "expo-local-authentication";

import i18n from "../services/i18n";

export const bioAuthenticate = async () => {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;

    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (supportedTypes.length === 0) return false;

    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!enrolled) return false;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: i18n.t("unlock_fallback"),
      fallbackLabel: i18n.t("unlock_fallback"),
      cancelLabel: i18n.t("cancel"),
      disableDeviceFallback: false,
    });
    console.info("biometric auth result:", result);

    return result.success;
  } catch (e) {
    console.warn("Biometric auth error:", e);
    return false;
  }
};