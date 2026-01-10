import * as LocalAuthentication from "expo-local-authentication";

export const bioAuthenticate = async () => {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;

    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (supportedTypes.length === 0) return false;

    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!enrolled) return false;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Authenticate",
      fallbackLabel: "Use Passcode",
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
    });
    console.info("biometric auth result:", result);

    return result.success;
  } catch (err) {
    console.warn("Biometric auth error:", err);
    return false;
  }
};