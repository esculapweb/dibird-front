import { useCallback } from "react";
import { Linking, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { BottomSheet } from "../services/bottomSheet";

export const useLocationUnavailable = (): (() => void) => {
  const { t } = useTranslation();

  const handleLocationUnavailable = useCallback((): void => {
    BottomSheet.show({
      title: t("location_unavailable"),
      description: t("location_unavailable_hint"),
      confirmText: t("open_settings"),
      cancelText: t("cancel"),
      onConfirm: () => {
        if (Platform.OS === "ios") {
          Linking.openURL("app-settings:");
        } else {
          Linking.openSettings();
        }
      },
    });
  }, [t]);

  return handleLocationUnavailable;
};
