import { useCallback } from "react";
import { Alert, Linking, Platform } from "react-native";
import { useTranslation } from "react-i18next";

export const useLocationUnavailable = (): (() => void) => {
  const { t } = useTranslation();

  const handleLocationUnavailable = useCallback((): void => {
    Alert.alert(t("location_unavailable"), t("location_unavailable_hint"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("open_settings"),
        onPress: () => {
          if (Platform.OS === "ios") {
            Linking.openURL("app-settings:");
          } else {
            Linking.openSettings();
          }
        },
      },
    ]);
  }, [t]);

  return handleLocationUnavailable;
};