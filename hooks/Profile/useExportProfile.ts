import { useState, useRef, useCallback, useEffect } from "react";

import { pollExportStatus, exportProfileData } from "../../util/fetches";
import { downloadAndShareExport } from "../../util/exportDownload";
import { ExportStatus, AppError } from "../../types";

export type ExportState = ExportStatus | "downloading";

/**
 * Starting the data export, and its status for the row in Settings.
 *
 * The export can take long enough that nobody should have to sit on this
 * screen for it: the backend sends a notification when it is done
 * (myapi/services/export.py), and tapping it is what downloads the file
 * (util/exportDownload). The polling here only keeps the row's label honest
 * while the screen happens to be open — reaching `completed` no longer
 * downloads anything on its own, it offers the download instead.
 */
export const useExportProfile = () => {
  const [state, setState] = useState<ExportState>("idle");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

        // `completed` without a token is not done yet as far as a download is
        // concerned — keep polling until the token is there.
        if (data.status === "completed" && !data.download_token) return;

        setState(data.status);

        if (
          data.status === "completed" ||
          data.status === "failed" ||
          data.status === "expired"
        ) {
          stopPolling();
        }
      } catch {
        stopPolling();
        setState("failed");
      }
    };

    check();
    intervalRef.current = setInterval(check, 5000);
  }, [stopPolling]);

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

  const download = useCallback(async () => {
    setState("downloading");
    try {
      const result = await downloadAndShareExport();
      setState(
        result === "shared"
          ? "idle"
          : result === "expired"
            ? "expired"
            : "processing",
      );
    } catch {
      setState("failed");
    }
  }, []);

  const cleanup = useCallback(() => stopPolling(), []);

  useEffect(() => stopPolling, [stopPolling]);

  return { state, triggerExport, download, cleanup };
};
