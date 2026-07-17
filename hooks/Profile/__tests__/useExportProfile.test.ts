jest.mock("../../../util/fetches", () => ({
  pollExportStatus: jest.fn(),
  exportProfileData: jest.fn(),
  downloadExportFile: jest.fn(),
}));
jest.mock("expo-sharing", () => ({ shareAsync: jest.fn() }));
jest.mock("../../../store/auth-context", () => ({ useAuth: jest.fn() }));

import { act, renderHook } from "@testing-library/react-native";
import * as Sharing from "expo-sharing";
import { pollExportStatus, exportProfileData, downloadExportFile } from "../../../util/fetches";
import { useAuth } from "../../../store/auth-context";
import { useExportProfile } from "../useExportProfile";
import { GdprExport } from "../../../types";

const gdprExport = (overrides: Partial<GdprExport> = {}): GdprExport => ({
  id: 1,
  status: "processing",
  created_at: "2026-01-01",
  downloaded_at: "",
  expires_at: "2026-01-02",
  ...overrides,
});

const advance = async (ms: number) => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  (useAuth as jest.Mock).mockReturnValue({ token: "tok" });
  (exportProfileData as jest.Mock).mockResolvedValue(undefined);
  (pollExportStatus as jest.Mock).mockResolvedValue(gdprExport());
});

afterEach(() => {
  jest.useRealTimers();
});

it("starts idle", async () => {
  const { result } = await renderHook(() => useExportProfile());
  expect(result.current.state).toBe("idle");
});

describe("triggerExport", () => {
  it("requests the export and starts polling on success", async () => {
    const { result } = await renderHook(() => useExportProfile());

    await act(async () => {
      await result.current.triggerExport();
    });
    expect(exportProfileData).toHaveBeenCalledTimes(1);
    expect(pollExportStatus).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe("processing");
  });

  it("still starts polling on a 429 (export already in progress server-side)", async () => {
    (exportProfileData as jest.Mock).mockRejectedValue({ response: { status: 429 } });
    const { result } = await renderHook(() => useExportProfile());

    await act(async () => {
      await result.current.triggerExport();
    });
    expect(pollExportStatus).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe("processing");
  });

  it("sets failed on any other error, without starting polling", async () => {
    (exportProfileData as jest.Mock).mockRejectedValue({ response: { status: 500 } });
    const { result } = await renderHook(() => useExportProfile());

    await act(async () => {
      await result.current.triggerExport();
    });
    expect(pollExportStatus).not.toHaveBeenCalled();
    expect(result.current.state).toBe("failed");
  });
});

describe("polling loop", () => {
  it("re-polls every 5s while still processing", async () => {
    const { result } = await renderHook(() => useExportProfile());
    await act(async () => {
      await result.current.triggerExport();
    });
    expect(pollExportStatus).toHaveBeenCalledTimes(1);

    await advance(5000);
    expect(pollExportStatus).toHaveBeenCalledTimes(2);

    await advance(5000);
    expect(pollExportStatus).toHaveBeenCalledTimes(3);
  });

  it("stops polling and surfaces the status on 'failed'", async () => {
    (pollExportStatus as jest.Mock).mockResolvedValue(gdprExport({ status: "failed" }));
    const { result } = await renderHook(() => useExportProfile());
    await act(async () => {
      await result.current.triggerExport();
    });
    expect(result.current.state).toBe("failed");

    await advance(5000);
    expect(pollExportStatus).toHaveBeenCalledTimes(1);
  });

  it("stops polling and surfaces the status on 'expired'", async () => {
    (pollExportStatus as jest.Mock).mockResolvedValue(gdprExport({ status: "expired" }));
    const { result } = await renderHook(() => useExportProfile());
    await act(async () => {
      await result.current.triggerExport();
    });
    expect(result.current.state).toBe("expired");

    await advance(5000);
    expect(pollExportStatus).toHaveBeenCalledTimes(1);
  });

  it("stops polling and sets failed when a poll request throws", async () => {
    (pollExportStatus as jest.Mock).mockRejectedValue(new Error("network down"));
    const { result } = await renderHook(() => useExportProfile());
    await act(async () => {
      await result.current.triggerExport();
    });
    expect(result.current.state).toBe("failed");

    await advance(5000);
    expect(pollExportStatus).toHaveBeenCalledTimes(1);
  });
});

describe("on completed", () => {
  it("downloads, shares, and returns to idle when the file has a uri", async () => {
    (pollExportStatus as jest.Mock).mockResolvedValue(
      gdprExport({ status: "completed", download_token: "dl-token" }),
    );
    (downloadExportFile as jest.Mock).mockResolvedValue({ uri: "file:///export.zip" });

    const { result } = await renderHook(() => useExportProfile());
    await act(async () => {
      await result.current.triggerExport();
    });

    expect(downloadExportFile).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed", download_token: "dl-token" }),
      "tok",
    );
    expect(Sharing.shareAsync).toHaveBeenCalledWith("file:///export.zip");
    expect(result.current.state).toBe("idle");

    await advance(5000);
    expect(pollExportStatus).toHaveBeenCalledTimes(1);
  });

  it("sets failed when the downloaded file has no uri", async () => {
    (pollExportStatus as jest.Mock).mockResolvedValue(
      gdprExport({ status: "completed", download_token: "dl-token" }),
    );
    (downloadExportFile as jest.Mock).mockResolvedValue({});

    const { result } = await renderHook(() => useExportProfile());
    await act(async () => {
      await result.current.triggerExport();
    });

    expect(Sharing.shareAsync).not.toHaveBeenCalled();
    expect(result.current.state).toBe("failed");
  });

  it("does not stop polling on 'completed' without a download_token yet", async () => {
    (pollExportStatus as jest.Mock).mockResolvedValue(gdprExport({ status: "completed" }));
    const { result } = await renderHook(() => useExportProfile());
    await act(async () => {
      await result.current.triggerExport();
    });
    expect(downloadExportFile).not.toHaveBeenCalled();

    await advance(5000);
    expect(pollExportStatus).toHaveBeenCalledTimes(2);
  });
});

describe("cleanup", () => {
  it("stops any in-flight polling", async () => {
    const { result } = await renderHook(() => useExportProfile());
    await act(async () => {
      await result.current.triggerExport();
    });
    expect(pollExportStatus).toHaveBeenCalledTimes(1);

    await act(() => {
      result.current.cleanup();
    });

    await advance(5000);
    expect(pollExportStatus).toHaveBeenCalledTimes(1);
  });
});
