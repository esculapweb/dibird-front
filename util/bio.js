export const bioAuthenticate = async () => {
  console.log("bioAuthenticate started"); // <-- сразу
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    console.log('hasHardware', hasHardware);
    if (!hasHardware) return false;

    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
    console.log('supportedTypes', supportedTypes);
    if (supportedTypes.length === 0) return false;

    const enrolled = await LocalAuthentication.isEnrolledAsync();
    console.log('enrolled', enrolled);
    if (!enrolled) return false;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Authenticate",
      fallbackLabel: "Use Passcode",
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
    });
    console.log("biometric auth result:", result);

    return result.success;
  } catch (err) {
    console.error("Biometric auth error:", err);
    return false;
  }
};