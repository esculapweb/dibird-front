jest.mock("../../../util/fetches", () => ({
  pollExportStatus: jest.fn(),
  exportProfileData: jest.fn(),
}));
jest.mock("../../../util/exportDownload", () => ({
  downloadAndShareExport: jest.fn(),
}));

import { act, renderHook } from "@testing-library/react-native";
import { pollExportStatus, exportProfileData } from "../../../util/fetches";
import { downloadAndShareExport } from "../../../util/exportDownload";
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
  // The export can outlast the screen; the file is fetched by a tap on the
  // push, or on this row — never by the polling itself.
  it("stops polling and offers the download without starting it", async () => {
    (pollExportStatus as jest.Mock).mockResolvedValue(
      gdprExport({ status: "completed", download_token: "dl-token" }),
    );

    const { result } = await renderHook(() => useExportProfile());
    await act(async () => {
      await result.current.triggerExport();
    });

    expect(result.current.state).toBe("completed");
    expect(downloadAndShareExport).not.toHaveBeenCalled();

    await advance(5000);
    expect(pollExportStatus).toHaveBeenCalledTimes(1);
  });

  it("does not stop polling on 'completed' without a download_token yet", async () => {
    (pollExportStatus as jest.Mock).mockResolvedValue(gdprExport({ status: "completed" }));
    const { result } = await renderHook(() => useExportProfile());
    await act(async () => {
      await result.current.triggerExport();
    });
    expect(result.current.state).not.toBe("completed");

    await advance(5000);
    expect(pollExportStatus).toHaveBeenCalledTimes(2);
  });
});

describe("download", () => {
  it.each([
    ["shared", "idle"],
    ["expired", "expired"],
    ["not_ready", "processing"],
  ])("maps a %s download to the %s state", async (outcome, state) => {
    (downloadAndShareExport as jest.Mock).mockResolvedValue(outcome);
    const { result } = await renderHook(() => useExportProfile());

    await act(async () => {
      await result.current.download();
    });

    expect(downloadAndShareExport).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe(state);
  });

  it("sets failed when the download throws", async () => {
    (downloadAndShareExport as jest.Mock).mockRejectedValue(new Error("404"));
    const { result } = await renderHook(() => useExportProfile());

    await act(async () => {
      await result.current.download();
    });

    expect(result.current.state).toBe("failed");
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
