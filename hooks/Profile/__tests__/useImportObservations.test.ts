jest.mock("../../../util/fetches", () => ({
  startObservationImport: jest.fn(),
  pollObservationImportStatus: jest.fn(),
}));
jest.mock("../../repositories/listCacheRepository", () => ({
  clearAllListCaches: jest.fn(),
}));
jest.mock("../../../services/analytics", () => ({ track: jest.fn() }));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));

import { act, renderHook } from "@testing-library/react-native";

import {
  startObservationImport,
  pollObservationImportStatus,
} from "../../../util/fetches";
import { clearAllListCaches } from "../../repositories/listCacheRepository";
import { track } from "../../../services/analytics";
import { useImportObservations } from "../useImportObservations";
import { ObservationImport } from "../../../types";

const mockStart = startObservationImport as jest.Mock;
const mockPoll = pollObservationImportStatus as jest.Mock;
const mockInvalidate = jest.fn();

const FILE = { uri: "file:///tmp/ebird.csv", name: "ebird.csv" };

const importRequest = (
  overrides: Partial<ObservationImport> = {},
): ObservationImport => ({
  id: 1,
  status: "processing",
  source: "ebird",
  make_public: false,
  total: 100,
  imported: 0,
  skipped: 0,
  unmatched: [],
  created_at: "2026-07-27T10:00:00Z",
  finished_at: null,
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
  mockStart.mockResolvedValue(importRequest({ status: "pending" }));
  mockPoll.mockResolvedValue(importRequest());
});

afterEach(() => {
  jest.useRealTimers();
});

it("starts idle", async () => {
  const { result } = await renderHook(() => useImportObservations());
  expect(result.current.state).toBe("idle");
  expect(result.current.result).toBeNull();
});

describe("starting an import", () => {
  it("uploads the file and begins polling", async () => {
    const { result } = await renderHook(() => useImportObservations());

    await act(async () => {
      await result.current.startImport(FILE, true);
    });

    expect(mockStart).toHaveBeenCalledWith(FILE, true);
    expect(mockPoll).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe("processing");
    expect(track).toHaveBeenCalledWith("import_started");
  });

  // A 429 means "an import is already running": the screen was reopened while
  // the task is working. Attaching to it is more correct than showing an error.
  it("attaches to a running import instead of failing on a 429", async () => {
    mockStart.mockRejectedValue({ response: { status: 429 } });

    const { result } = await renderHook(() => useImportObservations());

    await act(async () => {
      await result.current.startImport(FILE, false);
    });

    expect(mockPoll).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe("processing");
  });

  it("reports a real upload error", async () => {
    mockStart.mockRejectedValue({ response: { status: 400 } });

    const { result } = await renderHook(() => useImportObservations());

    await act(async () => {
      await result.current.startImport(FILE, false);
    });

    expect(mockPoll).not.toHaveBeenCalled();
    expect(result.current.state).toBe("failed");
  });
});

describe("polling", () => {
  it("keeps asking while the import is running", async () => {
    const { result } = await renderHook(() => useImportObservations());

    await act(async () => {
      await result.current.startImport(FILE, false);
    });
    await advance(5000);
    await advance(5000);

    expect(mockPoll).toHaveBeenCalledTimes(3);
    expect(result.current.state).toBe("processing");
  });

  // The records were created on the server bypassing the sync queue, and the
  // local SQLite knows nothing about them: without a reset the life list and the
  // statistics would stay pre-import.
  it("drops the offline mirror and refetches once the import completes", async () => {
    const done = importRequest({
      status: "completed",
      imported: 97,
      skipped: 3,
      unmatched: ["Carduelis chloris"],
    });
    mockPoll.mockResolvedValueOnce(importRequest()).mockResolvedValue(done);

    const { result } = await renderHook(() => useImportObservations());

    await act(async () => {
      await result.current.startImport(FILE, false);
    });
    await advance(5000);

    expect(result.current.state).toBe("completed");
    expect(result.current.result).toEqual(done);
    expect(clearAllListCaches).toHaveBeenCalledTimes(1);
    expect(mockInvalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["Observations"], refetchType: "all" }),
    );
    expect(track).toHaveBeenCalledWith("import_finished", {
      imported: 97,
      unmatched: 1,
    });
  });

  it("stops once the import is done", async () => {
    mockPoll.mockResolvedValue(importRequest({ status: "completed" }));

    const { result } = await renderHook(() => useImportObservations());

    await act(async () => {
      await result.current.startImport(FILE, false);
    });
    const callsAtCompletion = mockPoll.mock.calls.length;
    await advance(15000);

    expect(mockPoll).toHaveBeenCalledTimes(callsAtCompletion);
  });

  it("stops and reports failure when the status request itself dies", async () => {
    mockPoll.mockRejectedValue(new Error("offline"));

    const { result } = await renderHook(() => useImportObservations());

    await act(async () => {
      await result.current.startImport(FILE, false);
    });
    await advance(15000);

    expect(result.current.state).toBe("failed");
    expect(mockPoll).toHaveBeenCalledTimes(1);
  });

  it("does not touch the caches on a failed import", async () => {
    mockPoll.mockResolvedValue(importRequest({ status: "failed" }));

    const { result } = await renderHook(() => useImportObservations());

    await act(async () => {
      await result.current.startImport(FILE, false);
    });

    expect(result.current.state).toBe("failed");
    expect(clearAllListCaches).not.toHaveBeenCalled();
  });
});

it("returns to the start on reset", async () => {
  mockPoll.mockResolvedValue(importRequest({ status: "completed" }));

  const { result } = await renderHook(() => useImportObservations());

  await act(async () => {
    await result.current.startImport(FILE, false);
  });
  await act(async () => {
    result.current.reset();
  });

  expect(result.current.state).toBe("idle");
  expect(result.current.result).toBeNull();
});
