import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";

import { getErrorDetails } from "../services/api";

export const useApiError = () => {
  const { t } = useTranslation();

  const getTranslatedError = useCallback(
    (error) => {
      if (!error) {
        return {
          title: t("unexpected_error"),
          message: t("something_went_wrong"),
        };
      }

      if (error.title && error.message) {
        return {
          title: error.title,
          message: error.message,
          code: error.code,
          status: error.status,
        };
      }

      return getErrorDetails(error);
    },
    [t],
  );

  const showErrorToast = useCallback(
    (error) => {
      const { title, message } = getTranslatedError(error);

      if (typeof Toast?.show === "function") {
        Toast.show({
          type: "error",
          text1: title,
          text2: message,
        });
      }

      console.warn("API Error:", title, message, error)
    },
    [getTranslatedError],
  );

  return {
    getTranslatedError,
    showErrorToast,
  };
};
