import { useCallback } from "react";
import { Linking, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { BottomSheet } from "../services/bottomSheet";

export const useMediaLibraryUnavailable = (): (() => void) => {
  const { t } = useTranslation();

  return useCallback((): void => {
    BottomSheet.show({
      title: t("permission_denied"),
      description: t("allow_access_photo"),
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
};
