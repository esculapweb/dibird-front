import { useState, useRef, useCallback } from "react";
import * as Sharing from "expo-sharing";

import {
  pollExportStatus,
  exportProfileData,
  downloadExportFile,
} from "../../util/fetches";
import { ExportStatus, AppError } from "../../types";
import { useAuth } from "../../store/auth-context";

export const useExportProfile = () => {
  const [state, setState] = useState<ExportStatus>("idle");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { token } = useAuth();

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    const check = async () => {
      try {
        const data = await pollExportStatus();
        setState(data.status);

        if (data.status === "completed" && data.download_token) {
          stopPolling();

          const result = await downloadExportFile(data, token);

          if (result?.uri) {
            await Sharing.shareAsync(result.uri);
            setState("idle");
          } else {
            setState("failed");
          }
        } else if (data.status === "failed" || data.status === "expired") {
          stopPolling();
        }
      } catch {
        stopPolling();
        setState("failed");
      }
    };

    check();
    intervalRef.current = setInterval(check, 5000);
  }, [stopPolling, token]);

  const triggerExport = useCallback(async () => {
    try {
      setState("pending");
      await exportProfileData();
      startPolling();
    } catch (e) {
      const error = e as AppError;
      if (error?.response?.status === 429) {
        startPolling();
      } else {
        setState("failed");
      }
    }
  }, [startPolling]);

  const cleanup = useCallback(() => stopPolling(), []);

  return { state, triggerExport, cleanup };
};
