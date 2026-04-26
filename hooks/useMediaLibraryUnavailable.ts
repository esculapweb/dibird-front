import { useCallback } from "react";
import { Alert, Linking, Platform } from "react-native";
import { useTranslation } from "react-i18next";

export const useMediaLibraryUnavailable = (): (() => void) => {
  const { t } = useTranslation();

  return useCallback((): void => {
    Alert.alert(t("permission_denied"), t("allow_access_photo"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("open_settings"),
        onPress: () =>
          Platform.OS === "ios"
            ? Linking.openURL("app-settings:")
            : Linking.openSettings(),
      },
    ]);
  }, [t]);
};
