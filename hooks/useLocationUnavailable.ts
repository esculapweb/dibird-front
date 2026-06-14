import { useCallback } from "react";
import { Linking, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { BottomSheet } from "../services/bottomSheet";

export const useLocationUnavailable = (description?:string): (() => void) => {
  const { t } = useTranslation();
  const d = description ?? t("location_unavailable_hint")
  const handleLocationUnavailable = useCallback((): void => {
    BottomSheet.show({
      title: t("location_unavailable"),
      description: d,
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
