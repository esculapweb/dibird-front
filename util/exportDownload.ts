import * as SecureStore from "expo-secure-store";
import * as Sharing from "expo-sharing";
import Toast from "react-native-toast-message";

import { pollExportStatus, downloadExportFile } from "./fetches";
import i18n from "../services/i18n";
import { logError, showError } from "../services/errors";

export type ExportDownloadResult = "shared" | "expired" | "not_ready";

/**
 * Download the finished data export and open the share sheet.
 *
 * The one path for every place a download starts from: the push that says the
 * export is ready (hooks/usePushNotifications), its card in the bell
 * (screens/NotificationsScreen) and the row in Settings. The export takes long
 * enough that the app no longer waits for it on screen — the backend sends a
 * notification instead (myapi/services/export.py), and the file is fetched
 * only when the user taps it.
 *
 * The download token is not in the notification payload: the notification
 * outlives the 24-hour link, so the latest request is asked for here instead.
 * That request also goes through axios first, whose interceptor refreshes an
 * expired access token — `downloadAsync` bypasses axios and would otherwise
 * send a stale one when the tap comes hours after the export was started.
 *
 * Errors are thrown on to the caller, which owns the toast.
 */
export const downloadAndShareExport =
  async (): Promise<ExportDownloadResult> => {
    const data = await pollExportStatus();

    if (data.status === "expired") return "expired";
    if (data.status !== "completed" || !data.download_token) return "not_ready";

    const token = await SecureStore.getItemAsync("access");
    const result = await downloadExportFile(data, token);
    // `downloadAsync` does not reject on an HTTP error: a 404 (the file was
    // cleaned up between status/ and here) is saved to `dest` like the zip
    // would be, and would go to the share sheet as one.
    if (!result?.uri || result.status !== 200) {
      throw new Error(`Export download failed: HTTP ${result?.status}`);
    }

    await Sharing.shareAsync(result.uri);
    return "shared";
  };

/**
 * The tap on an "export is ready" notification — a push or its card in the
 * bell. Unlike the Settings row there is no screen state to put an outcome
 * into, so every outcome that is not the share sheet becomes a toast.
 */
export const downloadExportFromNotification = async (): Promise<void> => {
  try {
    const result = await downloadAndShareExport();
    // The link lives 24 hours, the notification for as long as the user keeps
    // it — tapping an old one is the expected way to land here.
    if (result === "expired") {
      Toast.show({ type: "info", text1: i18n.t("export_data_expired") });
    } else if (result === "not_ready") {
      // A newer export was started after this one finished, and status/ only
      // knows about the latest request.
      Toast.show({ type: "info", text1: i18n.t("export_data_in_progress") });
    }
  } catch (e) {
    logError(e, "downloadExportFromNotification");
    showError(e);
  }
};
