jest.mock("../fetches", () => ({
  pollExportStatus: jest.fn(),
  downloadExportFile: jest.fn(),
}));
jest.mock("expo-sharing", () => ({ shareAsync: jest.fn() }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn() }));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("../../services/errors", () => ({
  logError: jest.fn(),
  showError: jest.fn(),
}));

import * as Sharing from "expo-sharing";
import * as SecureStore from "expo-secure-store";
import Toast from "react-native-toast-message";

import { pollExportStatus, downloadExportFile } from "../fetches";
import { showError } from "../../services/errors";
import i18n from "../../services/i18n";
import {
  downloadAndShareExport,
  downloadExportFromNotification,
} from "../exportDownload";
import { GdprExport } from "../../types";

const gdprExport = (overrides: Partial<GdprExport> = {}): GdprExport => ({
  id: 1,
  status: "completed",
  download_token: "dl-token",
  created_at: "2026-01-01",
  downloaded_at: "",
  expires_at: "2026-01-02",
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  (pollExportStatus as jest.Mock).mockResolvedValue(gdprExport());
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("fresh-access");
  (downloadExportFile as jest.Mock).mockResolvedValue({
    uri: "file:///export.zip",
    status: 200,
  });
});

describe("downloadAndShareExport", () => {
  // The tap can come hours after the export was started: the token is read
  // after status/ went through axios, whose interceptor refreshes it.
  it("downloads with the current access token and shares the file", async () => {
    await expect(downloadAndShareExport()).resolves.toBe("shared");

    expect(downloadExportFile).toHaveBeenCalledWith(
      expect.objectContaining({ download_token: "dl-token" }),
      "fresh-access",
    );
    expect(Sharing.shareAsync).toHaveBeenCalledWith("file:///export.zip");
  });

  it("reports an expired export without downloading", async () => {
    (pollExportStatus as jest.Mock).mockResolvedValue(
      gdprExport({ status: "expired" }),
    );

    await expect(downloadAndShareExport()).resolves.toBe("expired");
    expect(downloadExportFile).not.toHaveBeenCalled();
  });

  it.each([
    ["processing", "dl-token"],
    ["completed", undefined],
  ])("is not ready while %s (token %s)", async (status, token) => {
    (pollExportStatus as jest.Mock).mockResolvedValue(
      gdprExport({ status: status as GdprExport["status"], download_token: token }),
    );

    await expect(downloadAndShareExport()).resolves.toBe("not_ready");
    expect(downloadExportFile).not.toHaveBeenCalled();
  });

  // downloadAsync saves an error body to disk like the real file — without
  // the check a 404 page would go to the share sheet as the export.
  it("throws instead of sharing an HTTP error saved as a file", async () => {
    (downloadExportFile as jest.Mock).mockResolvedValue({
      uri: "file:///export.zip",
      status: 404,
    });

    await expect(downloadAndShareExport()).rejects.toThrow("HTTP 404");
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });
});

describe("downloadExportFromNotification", () => {
  it("shows nothing extra when the share sheet opened", async () => {
    await downloadExportFromNotification();

    expect(Sharing.shareAsync).toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalled();
    expect(showError).not.toHaveBeenCalled();
  });

  it("tells the user an old notification's export has expired", async () => {
    (pollExportStatus as jest.Mock).mockResolvedValue(
      gdprExport({ status: "expired" }),
    );

    await downloadExportFromNotification();

    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ text1: i18n.t("export_data_expired") }),
    );
  });

  it("turns a failure into an error toast instead of rejecting", async () => {
    (pollExportStatus as jest.Mock).mockRejectedValue(new Error("offline"));

    await expect(downloadExportFromNotification()).resolves.toBeUndefined();
    expect(showError).toHaveBeenCalled();
  });
});
