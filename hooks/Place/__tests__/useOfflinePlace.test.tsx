// Mirrors hooks/Diary/__tests__/useOfflineDiary.test.tsx's setup/rationale —
// a real QueryClient exercises the online/offline branching and cache
// invalidation, while placeRepository is mocked wholesale (already covered
// by its own repository test suite).
jest.mock("../../../services/api", () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
}));
jest.mock("../../../store/language-context", () => ({ useLanguage: jest.fn() }));
jest.mock("../../../services/sync/networkStatus", () => ({ isConnected: jest.fn() }));
jest.mock("../../../services/sync/placeSync", () => ({ runPlaceSync: jest.fn() }));
jest.mock("../../repositories/placeRepository", () => ({
  getPlace: jest.fn(),
  upsertFromServer: jest.fn(),
  makeClientRequestId: jest.fn(() => "client-request-id"),
  createLocal: jest.fn(),
  updateLocal: jest.fn(),
  removeLocal: jest.fn(),
  deleteLocal: jest.fn(),
  withPendingObservationCount: jest.fn((item) => ({ ...item, pendingCount: 0 })),
}));
jest.mock("../../useApiError", () => ({ useApiError: () => ({ showErrorToast: mockShowErrorToast }) }));

import { QueryClient, QueryClientProvider, notifyManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import api from "../../../services/api";
import { useLanguage } from "../../../store/language-context";
import { isConnected } from "../../../services/sync/networkStatus";
import { runPlaceSync } from "../../../services/sync/placeSync";
import * as placeRepository from "../../repositories/placeRepository";
import { usePlaceItem, useCreatePlace, useUpdatePlace, useDeletePlace } from "../useOfflinePlace";

// See useOfflineDiary.test.tsx's comment on this — keeps state updates
// inside the same act() as the awaited mutation/query instead of a tick later.
notifyManager.setScheduler((callback) => callback());

const mockShowErrorToast = jest.fn();

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
  (useLanguage as jest.Mock).mockReturnValue({ language: "en" });
  (isConnected as jest.Mock).mockReturnValue(true);
});

afterEach(() => {
  queryClient.clear();
});

describe("usePlaceItem", () => {
  it("reads a not-yet-synced local place (negative id) straight from the repository, folding in the pending-observation count", async () => {
    (placeRepository.getPlace as jest.Mock).mockReturnValue({ id: -1, name: "Local place" });
    const { result } = await renderHook(() => usePlaceItem(-1), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: -1, name: "Local place", pendingCount: 0 });
    expect(api.get).not.toHaveBeenCalled();
  });

  it("throws when a negative id has no local record", async () => {
    (placeRepository.getPlace as jest.Mock).mockReturnValue(null);
    const { result } = await renderHook(() => usePlaceItem(-1), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("fetches from the server (forwarding params) and folds in the pending-observation count even on a live fetch", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { id: 5, name: "Server place" } });
    const { result } = await renderHook(() => usePlaceItem(5, { date: "2026-01-01" }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith("/myapi/place2/5/", { params: { date: "2026-01-01" } });
    expect(placeRepository.upsertFromServer).toHaveBeenCalledWith({ id: 5, name: "Server place" });
    expect(result.current.data).toEqual({ id: 5, name: "Server place", pendingCount: 0 });
  });

  it("falls back to the cached local copy (still folding in pending count) when the fetch fails", async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error("boom"));
    (placeRepository.getPlace as jest.Mock).mockReturnValue({ id: 5, name: "Cached place" });
    const { result } = await renderHook(() => usePlaceItem(5), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: 5, name: "Cached place", pendingCount: 0 });
  });

  it("surfaces the fetch error via showErrorToast when there's no cached fallback", async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error("boom"));
    (placeRepository.getPlace as jest.Mock).mockReturnValue(null);
    const { result } = await renderHook(() => usePlaceItem(5), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockShowErrorToast).toHaveBeenCalledWith(expect.any(Error), "usePlaceItem");
  });

  it("accepts a matching initial item as a seed, without it blocking the real background refetch", async () => {
    const initialItem = { id: 5, name: "Seeded" };
    (api.get as jest.Mock).mockResolvedValue({ data: { id: 5, name: "Server-fresh" } });
    const { result } = await renderHook(() => usePlaceItem(5, undefined, initialItem as never), { wrapper });

    // initialDataUpdatedAt: 0 makes the seed count as stale, so react-query
    // still kicks off (and here, awaits) a background refetch that
    // supersedes it — proving the seed doesn't accidentally skip the fetch.
    await waitFor(() => expect(result.current.data).toEqual({ id: 5, name: "Server-fresh", pendingCount: 0 }));
    expect(api.get).toHaveBeenCalledWith("/myapi/place2/5/", { params: undefined });
  });

  // Regression: a place's territory_data.name is localized by the request's
  // Accept-Language, so reopening a place after a language switch used to serve
  // the day-long stale previous-language copy. The language must be part of the
  // query key.
  it("refetches under a new key when the language changes, instead of serving the stale previous-language copy", async () => {
    (api.get as jest.Mock)
      .mockResolvedValueOnce({ data: { id: 5, territory_data: { name: "Germany" } } })
      .mockResolvedValueOnce({ data: { id: 5, territory_data: { name: "Германия" } } });

    (useLanguage as jest.Mock).mockReturnValue({ language: "en" });
    const { result, rerender } = await renderHook(() => usePlaceItem(5), { wrapper });
    await waitFor(() =>
      expect(result.current.data?.territory_data?.name).toBe("Germany"),
    );

    (useLanguage as jest.Mock).mockReturnValue({ language: "ru" });
    await act(async () => {
      rerender({});
    });

    await waitFor(() =>
      expect(result.current.data?.territory_data?.name).toBe("Германия"),
    );
    expect(api.get).toHaveBeenCalledTimes(2);
  });
});

describe("useCreatePlace", () => {
  it("posts to the server and caches the result when online", async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { id: 5, name: "New place" } });
    const { result } = await renderHook(() => useCreatePlace(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: "New place" } as never);
    });

    expect(api.post).toHaveBeenCalledWith("/myapi/place2/", {
      name: "New place",
      client_request_id: "client-request-id",
    });
    expect(placeRepository.upsertFromServer).toHaveBeenCalledWith({ id: 5, name: "New place" });
    expect(placeRepository.createLocal).not.toHaveBeenCalled();
  });

  it("falls back to a local draft and triggers sync when the server is unreachable", async () => {
    (api.post as jest.Mock).mockRejectedValue(networkError());
    (placeRepository.createLocal as jest.Mock).mockReturnValue({ id: -1, name: "Offline place" });
    const { result } = await renderHook(() => useCreatePlace(), { wrapper });

    let created: unknown;
    await act(async () => {
      created = await result.current.mutateAsync({ name: "Offline place" } as never);
    });

    expect(placeRepository.createLocal).toHaveBeenCalledWith({ name: "Offline place" }, "client-request-id");
    expect(runPlaceSync).toHaveBeenCalledTimes(1);
    expect(created).toEqual({ id: -1, name: "Offline place" });
  });

  it("skips the network call entirely when already offline", async () => {
    (isConnected as jest.Mock).mockReturnValue(false);
    (placeRepository.createLocal as jest.Mock).mockReturnValue({ id: -1 });
    const { result } = await renderHook(() => useCreatePlace(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({} as never);
    });

    expect(api.post).not.toHaveBeenCalled();
    expect(placeRepository.createLocal).toHaveBeenCalledTimes(1);
  });

  it("does not toast a 400 validation error, but does toast other errors", async () => {
    (api.post as jest.Mock).mockRejectedValue(validationError());
    const { result: validationResult } = await renderHook(() => useCreatePlace(), { wrapper });
    await act(async () => {
      await expect(validationResult.current.mutateAsync({} as never)).rejects.toThrow();
    });
    expect(mockShowErrorToast).not.toHaveBeenCalled();

    (api.post as jest.Mock).mockRejectedValue(Object.assign(new Error("server exploded"), { status: 500 }));
    const { result: serverResult } = await renderHook(() => useCreatePlace(), { wrapper });
    await act(async () => {
      await expect(serverResult.current.mutateAsync({} as never)).rejects.toThrow();
    });
    expect(mockShowErrorToast).toHaveBeenCalledWith(expect.objectContaining({ message: "server exploded" }));
  });

  it("invalidates the Place-related caches on settle", async () => {
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
    (api.post as jest.Mock).mockResolvedValue({ data: { id: 5 } });
    const { result } = await renderHook(() => useCreatePlace(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({} as never);
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map((call) => call[0]?.queryKey);
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([["Places"], ["Place"], ["Observations"], ["Diaries"], ["DashboardStat"]]),
    );
  });
});

describe("useUpdatePlace", () => {
  it("rejects immediately when there's no id to update", async () => {
    const { result } = await renderHook(() => useUpdatePlace(null), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({} as never)).rejects.toThrow("Missing place id");
    });
    expect(placeRepository.updateLocal).not.toHaveBeenCalled();
  });

  it("patches the server for an already-synced place when online", async () => {
    (api.patch as jest.Mock).mockResolvedValue({ data: { id: 5, name: "Patched" } });
    const { result } = await renderHook(() => useUpdatePlace(5), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: "Patched" } as never);
    });

    expect(api.patch).toHaveBeenCalledWith("/myapi/place2/5/", { name: "Patched" });
    expect(placeRepository.upsertFromServer).toHaveBeenCalledWith({ id: 5, name: "Patched" });
    expect(placeRepository.updateLocal).not.toHaveBeenCalled();
  });

  it("reads the authoritative local snapshot (not the react-query cache) as the merge base when falling back locally", async () => {
    (api.patch as jest.Mock).mockRejectedValue(networkError());
    (placeRepository.getPlace as jest.Mock).mockReturnValue({ id: 5, name: "Local snapshot" });
    (placeRepository.updateLocal as jest.Mock).mockReturnValue({ id: 5, name: "Merged" });
    const { result } = await renderHook(() => useUpdatePlace(5), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: "Local edit" } as never);
    });

    expect(placeRepository.getPlace).toHaveBeenCalledWith(5);
    expect(placeRepository.updateLocal).toHaveBeenCalledWith(5, { name: "Local edit" }, { id: 5, name: "Local snapshot" });
    expect(runPlaceSync).toHaveBeenCalledTimes(1);
  });

  it("amends a still-local (never synced) place without touching the network or sync", async () => {
    (placeRepository.getPlace as jest.Mock).mockReturnValue({ id: -1, name: "Draft" });
    (placeRepository.updateLocal as jest.Mock).mockReturnValue({ id: -1, name: "Amended" });
    const { result } = await renderHook(() => useUpdatePlace(-1), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: "Amended" } as never);
    });

    expect(api.patch).not.toHaveBeenCalled();
    expect(runPlaceSync).not.toHaveBeenCalled();
  });
});

describe("useDeletePlace", () => {
  it("deletes on the server for an already-synced place when online", async () => {
    (api.delete as jest.Mock).mockResolvedValue({});
    const { result } = await renderHook(() => useDeletePlace(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(5);
    });

    expect(api.delete).toHaveBeenCalledWith("/myapi/place2/5/");
    expect(placeRepository.removeLocal).toHaveBeenCalledWith(5);
    expect(placeRepository.deleteLocal).not.toHaveBeenCalled();
  });

  it("deletes locally and re-triggers sync when the server delete fails over the network", async () => {
    (api.delete as jest.Mock).mockRejectedValue(networkError());
    const { result } = await renderHook(() => useDeletePlace(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(5);
    });

    expect(placeRepository.deleteLocal).toHaveBeenCalledWith(5);
    expect(runPlaceSync).toHaveBeenCalledTimes(1);
  });

  it("deletes a still-local (never synced) place without touching the network or sync", async () => {
    const { result } = await renderHook(() => useDeletePlace(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(-1);
    });

    expect(api.delete).not.toHaveBeenCalled();
    expect(placeRepository.deleteLocal).toHaveBeenCalledWith(-1);
    expect(runPlaceSync).not.toHaveBeenCalled();
  });

  it("skips the network call entirely when already offline, but still re-triggers sync for a synced place", async () => {
    (isConnected as jest.Mock).mockReturnValue(false);
    const { result } = await renderHook(() => useDeletePlace(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(5);
    });

    expect(api.delete).not.toHaveBeenCalled();
    expect(placeRepository.deleteLocal).toHaveBeenCalledWith(5);
    expect(runPlaceSync).toHaveBeenCalledTimes(1);
  });
});
