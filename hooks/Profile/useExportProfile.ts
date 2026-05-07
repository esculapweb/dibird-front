import { useState, useRef, useCallback } from "react";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { pollExportStatus, exportProfileData } from "../../util/fetches";
import { ExportStatus, AppError } from "../../types";
import { Config } from "../../constants/config";
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

          const url = `${Config.baseUrl}/myapi/gdpr/download/?token=${data.download_token}`;
          const dest = FileSystem.documentDirectory + "dibird_export.zip";

          const result = await FileSystem.downloadAsync(url, dest, {
            headers: { Authorization: `Bearer ${token}` },
          });

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
