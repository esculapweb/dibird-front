import { useCallback, useEffect } from "react";
import Toast from "react-native-toast-message";

import { logError, showError } from "../services/errors";
import { ErrorExtractor } from "../types";
import { useProfile } from "../store/profile-context";

export const useApiError = () => {
  const { error: profileError, profileLoading } = useProfile();

  useEffect(() => {
    if (profileError) Toast.hide();
  }, [profileError]);

  const showErrorToast = useCallback(
    (error: unknown, tag?: string, extractor?: ErrorExtractor): void => {
      if (!error || profileError || profileLoading) return;
      logError(error, tag);
      showError(error, extractor);
    },
    [profileError, profileLoading, logError, showError],
  );

  return { showErrorToast };
};
