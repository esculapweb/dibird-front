import * as LocalAuthentication from "expo-local-authentication";
import { useTranslation } from "react-i18next";

export const bioAuthenticate = async () => {
  const { t } = useTranslation();

  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;

    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (supportedTypes.length === 0) return false;

    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!enrolled) return false;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: t("unlock_fallback"),
      fallbackLabel: t("unlock_fallback"),
      cancelLabel: t("cancel"),
      disableDeviceFallback: false,
    });
    console.info("biometric auth result:", result);

    return result.success;
  } catch (err) {
    console.warn("Biometric auth error:", err);
    return false;
  }
};