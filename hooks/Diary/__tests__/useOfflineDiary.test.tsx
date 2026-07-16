// useOfflineDiary wraps @tanstack/react-query directly (unlike most other
// hook tests in this repo, which mock the query lib entirely) — the
// online/offline branching and cache invalidation IS the thing under test,
// so a real QueryClient is used here instead. diaryRepository itself is
// mocked wholesale — its own behavior is already covered by
// hooks/repositories/__tests__/diaryRepository.test.ts.
jest.mock("../../../services/api", () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
}));
jest.mock("../../../store/profile-context", () => ({ useProfile: jest.fn() }));
jest.mock("../../../services/sync/networkStatus", () => ({ isConnected: jest.fn() }));
jest.mock("../../../services/sync/diarySync", () => ({ runDiarySync: jest.fn() }));
jest.mock("../../repositories/diaryRepository", () => ({
  getDiary: jest.fn(),
  upsertFromServer: jest.fn(),
  cacheKnownSnapshot: jest.fn(),
  makeClientRequestId: jest.fn(() => "client-request-id"),
  createLocal: jest.fn(),
  updateLocal: jest.fn(),
  removeLocal: jest.fn(),
  deleteLocal: jest.fn(),
}));
jest.mock("../../useApiError", () => ({ useApiError: () => ({ showErrorToast: mockShowErrorToast }) }));

import { QueryClient, QueryClientProvider, notifyManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

// react-query's default notifyManager scheduler batches subscriber updates
// via a real setTimeout(0) — decoupled from mutateAsync's own promise, so it
// fires a tick after our act() block already resolved, producing act()
// warnings and a lingering timer. Making it synchronous keeps every state
// update inside the same act() as the awaited mutation/query.
notifyManager.setScheduler((callback) => callback());
import api from "../../../services/api";
import { useProfile } from "../../../store/profile-context";
import { isConnected } from "../../../services/sync/networkStatus";
import { runDiarySync } from "../../../services/sync/diarySync";
import * as diaryRepository from "../../repositories/diaryRepository";
import {
  useDiaryItem,
  useCreateDiary,
  useUpdateDiary,
  useDeleteDiary,
} from "../useOfflineDiary";

const mockShowErrorToast = jest.fn();
const PROFILE = { user: 9, avatar: "", user_data: { first_name: "Jane" }, private: false, timezone: "UTC" };

const networkError = (): Error & { isNetworkError: boolean } =>
  Object.assign(new Error("network down"), { isNetworkError: true });
const validationError = (): Error & { status: number; response: { data: Record<string, unknown> } } =>
  Object.assign(new Error("bad request"), { status: 400, response: { data: { name: ["required"] } } });

let queryClient: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

beforeEach(() => {
  jest.clearAllMocks();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  (useProfile as jest.Mock).mockReturnValue({ profile: PROFILE });
  (isConnected as jest.Mock).mockReturnValue(true);
});

afterEach(() => {
  queryClient.clear();
});

describe("useDiaryItem", () => {
  it("reads a not-yet-synced local diary (negative id) straight from the repository, without hitting the API", async () => {
    (diaryRepository.getDiary as jest.Mock).mockReturnValue({ id: -1, name: "Local diary" });
    const { result } = await renderHook(() => useDiaryItem(-1), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: -1, name: "Local diary" });
    expect(api.get).not.toHaveBeenCalled();
  });

  it("throws when a negative id has no local record", async () => {
    (diaryRepository.getDiary as jest.Mock).mockReturnValue(null);
    const { result } = await renderHook(() => useDiaryItem(-1), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockShowErrorToast).toHaveBeenCalledWith(expect.any(Error), "useDiaryItem");
  });

  it("fetches from the server and caches it on success", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { id: 5, name: "Server diary" } });
    const { result } = await renderHook(() => useDiaryItem(5), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: 5, name: "Server diary" });
    expect(diaryRepository.upsertFromServer).toHaveBeenCalledWith({ id: 5, name: "Server diary" });
  });

  it("falls back to the cached local copy when the fetch fails, without surfacing an error", async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error("boom"));
    (diaryRepository.getDiary as jest.Mock).mockReturnValue({ id: 5, name: "Cached diary" });
    const { result } = await renderHook(() => useDiaryItem(5), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: 5, name: "Cached diary" });
  });

  it("surfaces the fetch error via showErrorToast when there's no cached fallback", async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error("boom"));
    (diaryRepository.getDiary as jest.Mock).mockReturnValue(null);
    const { result } = await renderHook(() => useDiaryItem(5), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockShowErrorToast).toHaveBeenCalledWith(expect.any(Error), "useDiaryItem");
  });

  it("does not query at all without an id", async () => {
    await renderHook(() => useDiaryItem(null), { wrapper });
    expect(api.get).not.toHaveBeenCalled();
    expect(diaryRepository.getDiary).not.toHaveBeenCalled();
  });

  it("seeds the query with a best-effort snapshot derived from an initial list item, and persists it", async () => {
    const initialItem = { id: 5, profile: 9, date_time: "2026-01-01T00:00:00Z" };
    const { result } = await renderHook(() => useDiaryItem(5, initialItem as never), { wrapper });

    // Present synchronously — initialData, no network round-trip needed.
    expect(result.current.data).toEqual(
      expect.objectContaining({
        id: 5,
        is_owner: true,
        owner: expect.objectContaining({ id: 9 }),
        created_at: "2026-01-01T00:00:00Z",
      }),
    );
    expect(diaryRepository.cacheKnownSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ id: 5, is_owner: true }),
    );
  });
});

describe("useCreateDiary", () => {
  it("posts to the server and caches the result when online", async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { id: 5, name: "New diary" } });
    const { result } = await renderHook(() => useCreateDiary(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ payload: { name: "New diary" } as never });
    });

    expect(api.post).toHaveBeenCalledWith("/myapi/diary2/", {
      name: "New diary",
      client_request_id: "client-request-id",
    });
    expect(diaryRepository.upsertFromServer).toHaveBeenCalledWith({ id: 5, name: "New diary" });
    expect(diaryRepository.createLocal).not.toHaveBeenCalled();
    expect(runDiarySync).not.toHaveBeenCalled();
  });

  it("falls back to a local draft and triggers sync when the server is unreachable", async () => {
    (api.post as jest.Mock).mockRejectedValue(networkError());
    (diaryRepository.createLocal as jest.Mock).mockReturnValue({ id: -1, name: "Offline diary" });
    const { result } = await renderHook(() => useCreateDiary(), { wrapper });

    let created: unknown;
    await act(async () => {
      created = await result.current.mutateAsync({ payload: { name: "Offline diary" } as never });
    });

    expect(diaryRepository.createLocal).toHaveBeenCalledWith(
      { name: "Offline diary" },
      { placeData: undefined },
      PROFILE,
      "client-request-id",
    );
    expect(runDiarySync).toHaveBeenCalledTimes(1);
    expect(created).toEqual({ id: -1, name: "Offline diary" });
  });

  it("skips the network call entirely when already offline", async () => {
    (isConnected as jest.Mock).mockReturnValue(false);
    (diaryRepository.createLocal as jest.Mock).mockReturnValue({ id: -1 });
    const { result } = await renderHook(() => useCreateDiary(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ payload: { name: "x" } as never });
    });

    expect(api.post).not.toHaveBeenCalled();
    expect(diaryRepository.createLocal).toHaveBeenCalledTimes(1);
  });

  it("rejects without falling back to a local draft on a non-network server error", async () => {
    (api.post as jest.Mock).mockRejectedValue(validationError());
    const { result } = await renderHook(() => useCreateDiary(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ payload: {} as never })).rejects.toThrow("bad request");
    });
    expect(diaryRepository.createLocal).not.toHaveBeenCalled();
  });

  it("does not toast a 400 validation error, but does toast other errors", async () => {
    (api.post as jest.Mock).mockRejectedValue(validationError());
    const { result: validationResult } = await renderHook(() => useCreateDiary(), { wrapper });
    await act(async () => {
      await expect(validationResult.current.mutateAsync({ payload: {} as never })).rejects.toThrow();
    });
    expect(mockShowErrorToast).not.toHaveBeenCalled();

    (api.post as jest.Mock).mockRejectedValue(Object.assign(new Error("server exploded"), { status: 500 }));
    const { result: serverResult } = await renderHook(() => useCreateDiary(), { wrapper });
    await act(async () => {
      await expect(serverResult.current.mutateAsync({ payload: {} as never })).rejects.toThrow();
    });
    expect(mockShowErrorToast).toHaveBeenCalledWith(expect.objectContaining({ message: "server exploded" }));
  });

  it("invalidates the Diary-related caches on settle regardless of outcome", async () => {
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
    (api.post as jest.Mock).mockResolvedValue({ data: { id: 5 } });
    const { result } = await renderHook(() => useCreateDiary(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ payload: {} as never });
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map((call) => call[0]?.queryKey);
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([["Diaries"], ["Diary"], ["Observation"], ["Place"], ["DashboardStat"]]),
    );
  });
});

describe("useUpdateDiary", () => {
  it("rejects immediately when there's no id to update", async () => {
    const { result } = await renderHook(() => useUpdateDiary(null), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ payload: {} as never })).rejects.toThrow("Missing diary id");
    });
    expect(diaryRepository.updateLocal).not.toHaveBeenCalled();
  });

  it("patches the server for an already-synced diary when online", async () => {
    (api.patch as jest.Mock).mockResolvedValue({ data: { id: 5, name: "Patched" } });
    const { result } = await renderHook(() => useUpdateDiary(5), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ payload: { name: "Patched" } as never });
    });

    expect(api.patch).toHaveBeenCalledWith("/myapi/diary2/5/", { name: "Patched" });
    expect(diaryRepository.upsertFromServer).toHaveBeenCalledWith({ id: 5, name: "Patched" });
    expect(diaryRepository.updateLocal).not.toHaveBeenCalled();
  });

  it("updates locally and re-triggers sync when the patch fails over the network, for an already-synced diary", async () => {
    (api.patch as jest.Mock).mockRejectedValue(networkError());
    (diaryRepository.updateLocal as jest.Mock).mockReturnValue({ id: 5, name: "Local edit" });
    const { result } = await renderHook(() => useUpdateDiary(5), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ payload: { name: "Local edit" } as never });
    });

    expect(diaryRepository.updateLocal).toHaveBeenCalledWith(
      5,
      { name: "Local edit" },
      null,
      { placeData: undefined },
      PROFILE,
    );
    expect(runDiarySync).toHaveBeenCalledTimes(1);
  });

  it("amends a still-local (never synced) diary in place, without triggering sync", async () => {
    (diaryRepository.updateLocal as jest.Mock).mockReturnValue({ id: -1, name: "Still local" });
    const { result } = await renderHook(() => useUpdateDiary(-1), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ payload: { name: "Still local" } as never });
    });

    expect(api.patch).not.toHaveBeenCalled();
    expect(diaryRepository.updateLocal).toHaveBeenCalledWith(
      -1,
      { name: "Still local" },
      null,
      { placeData: undefined },
      PROFILE,
    );
    expect(runDiarySync).not.toHaveBeenCalled();
  });

  it("reads the current cached item as the merge base when falling back locally", async () => {
    queryClient.setQueryData(["Diary", 5], { id: 5, name: "Cached base" });
    (api.patch as jest.Mock).mockRejectedValue(networkError());
    const { result } = await renderHook(() => useUpdateDiary(5), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ payload: { name: "x" } as never });
    });

    expect(diaryRepository.updateLocal).toHaveBeenCalledWith(
      5,
      { name: "x" },
      { id: 5, name: "Cached base" },
      { placeData: undefined },
      PROFILE,
    );
  });
});

describe("useDeleteDiary", () => {
  it("deletes on the server for an already-synced diary when online", async () => {
    (api.delete as jest.Mock).mockResolvedValue({});
    const { result } = await renderHook(() => useDeleteDiary(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(5);
    });

    expect(api.delete).toHaveBeenCalledWith("/myapi/diary2/5/");
    expect(diaryRepository.removeLocal).toHaveBeenCalledWith(5);
    expect(diaryRepository.deleteLocal).not.toHaveBeenCalled();
  });

  it("deletes locally and re-triggers sync when the server delete fails over the network", async () => {
    (api.delete as jest.Mock).mockRejectedValue(networkError());
    const { result } = await renderHook(() => useDeleteDiary(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(5);
    });

    expect(diaryRepository.deleteLocal).toHaveBeenCalledWith(5);
    expect(runDiarySync).toHaveBeenCalledTimes(1);
  });

  it("deletes a still-local (never synced) diary without touching the network or sync", async () => {
    const { result } = await renderHook(() => useDeleteDiary(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(-1);
    });

    expect(api.delete).not.toHaveBeenCalled();
    expect(diaryRepository.deleteLocal).toHaveBeenCalledWith(-1);
    expect(runDiarySync).not.toHaveBeenCalled();
  });

  it("skips the network call entirely when already offline, but still re-triggers sync for a synced diary", async () => {
    (isConnected as jest.Mock).mockReturnValue(false);
    const { result } = await renderHook(() => useDeleteDiary(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(5);
    });

    expect(api.delete).not.toHaveBeenCalled();
    expect(diaryRepository.deleteLocal).toHaveBeenCalledWith(5);
    expect(runDiarySync).toHaveBeenCalledTimes(1);
  });
});
