import { useCallback, useEffect } from "react";
import Toast from "react-native-toast-message";

import { logError, showError } from "../services/errors";
import { track } from "../services/analytics";
import { navigationRef } from "../services/navigationRef";
import { AppError, ErrorExtractor } from "../types";
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
      // #90. The normalized code only, never the message (it can carry
      // server text). Lives here, not in services/errors.ts: analytics.ts
      // imports logError from there, and the reverse import would be a cycle.
      track("error_shown", {
        screen: navigationRef.current?.isReady()
          ? (navigationRef.current.getCurrentRoute()?.name ?? "unknown")
          : "unknown",
        error_code: (error as AppError).code || "unknown",
      });
    },
    [profileError, profileLoading, logError, showError],
  );

  return { showErrorToast };
};
