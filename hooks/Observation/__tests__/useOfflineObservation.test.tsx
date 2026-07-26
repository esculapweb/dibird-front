// Mirrors hooks/Diary/__tests__/useOfflineDiary.test.tsx's setup/rationale —
// a real QueryClient exercises the online/offline branching and cache
// invalidation, while observationRepository/diaryRepository are mocked
// wholesale (already covered by their own repository test suites). The one
// thing genuinely unique to this hook is resolveObservationDiary's temp-id
// resolution for diary-scoped observations — see the dedicated describe
// block below.
jest.mock("../../../services/api", () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
}));
jest.mock("../../../store/profile-context", () => ({ useProfile: jest.fn() }));
jest.mock("../../../store/language-context", () => ({ useLanguage: jest.fn() }));
jest.mock("../../../services/sync/networkStatus", () => ({ isConnected: jest.fn() }));
jest.mock("../../../services/sync/observationSync", () => ({ runObservationSync: jest.fn() }));
jest.mock("../../repositories/observationRepository", () => ({
  getObservation: jest.fn(),
  upsertFromServer: jest.fn(),
  makeClientRequestId: jest.fn(() => "client-request-id"),
  createLocal: jest.fn(),
  updateLocal: jest.fn(),
  removeLocal: jest.fn(),
  deleteLocal: jest.fn(),
}));
jest.mock("../../repositories/diaryRepository", () => ({
  resolveDiaryId: jest.fn((id: number | null | undefined) => id),
  getDiary: jest.fn(),
}));
jest.mock("../../useApiError", () => ({ useApiError: () => ({ showErrorToast: mockShowErrorToast }) }));

import { QueryClient, QueryClientProvider, notifyManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import api from "../../../services/api";
import { useProfile } from "../../../store/profile-context";
import { useLanguage } from "../../../store/language-context";
import { isConnected } from "../../../services/sync/networkStatus";
import { runObservationSync } from "../../../services/sync/observationSync";
import * as observationRepository from "../../repositories/observationRepository";
import * as diaryRepository from "../../repositories/diaryRepository";
import {
  useObservationItem,
  useCreateObservation,
  useUpdateObservation,
  useDeleteObservation,
} from "../useOfflineObservation";

// See useOfflineDiary.test.tsx's comment on this — keeps state updates
// inside the same act() as the awaited mutation/query instead of a tick later.
notifyManager.setScheduler((callback) => callback());

const mockShowErrorToast = jest.fn();
const PROFILE = { user: 9, avatar: "", user_data: { first_name: "Jane" }, private: false, timezone: "UTC" };

const networkError = (): Error & { isNetworkError: boolean } =>
  Object.assign(new Error("network down"), { isNetworkError: true });
const validationError = (): Error & { status: number; response: { data: Record<string, unknown> } } =>
  Object.assign(new Error("bad request"), { status: 400, response: { data: { species: ["required"] } } });

let queryClient: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

beforeEach(() => {
  jest.clearAllMocks();
  queryClient = new QueryClient({
    // gcTime: 0 on mutations is load-bearing — see useOfflineDiary.test.tsx.
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  (useProfile as jest.Mock).mockReturnValue({ profile: PROFILE });
  (useLanguage as jest.Mock).mockReturnValue({ language: "en" });
  (isConnected as jest.Mock).mockReturnValue(true);
  (diaryRepository.resolveDiaryId as jest.Mock).mockImplementation((id: number | null | undefined) => id);
});

afterEach(() => {
  queryClient.clear();
});

describe("useObservationItem", () => {
  it("reads a not-yet-synced local observation (negative id) straight from the repository, without hitting the API", async () => {
    (observationRepository.getObservation as jest.Mock).mockReturnValue({ id: -1, notes: "local" });
    const { result } = await renderHook(() => useObservationItem(-1), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: -1, notes: "local" });
    expect(api.get).not.toHaveBeenCalled();
  });

  it("fetches from the server and caches it on success", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { id: 5, notes: "server" } });
    const { result } = await renderHook(() => useObservationItem(5), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(observationRepository.upsertFromServer).toHaveBeenCalledWith({ id: 5, notes: "server" });
  });

  it("falls back to the cached local copy when the fetch fails", async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error("boom"));
    (observationRepository.getObservation as jest.Mock).mockReturnValue({ id: 5, notes: "cached" });
    const { result } = await renderHook(() => useObservationItem(5), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: 5, notes: "cached" });
  });

  it("surfaces the fetch error via showErrorToast when there's no cached fallback", async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error("boom"));
    (observationRepository.getObservation as jest.Mock).mockReturnValue(null);
    const { result } = await renderHook(() => useObservationItem(5), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockShowErrorToast).toHaveBeenCalledWith(expect.any(Error), "useObservationItem");
  });

  it("recomputes is_owner from the owner id vs the current profile, distrusting a seeded initial item's own flag", async () => {
    const initialItem = { id: 5, is_owner: true, owner: { id: 999 } };
    const { result } = await renderHook(() => useObservationItem(5, initialItem as never), { wrapper });

    expect(result.current.data).toEqual(expect.objectContaining({ is_owner: false }));
  });

  // Regression: opening an observation in one language then switching languages
  // and reopening it used to keep showing the first-language species name and,
  // because species_data.segment is localized too, left the "about species"
  // link unresolvable (ObservationDetailScreen's speciesDetails(segment) no-ops
  // on a stale/empty segment). The language must be part of the query key so a
  // switch forces a fresh, correctly-localized fetch rather than the day-long
  // stale copy.
  it("refetches under a new key when the language changes, instead of serving the stale previous-language copy", async () => {
    (api.get as jest.Mock)
      .mockResolvedValueOnce({
        data: { id: 5, species_data: { name_lang: "Mallard", segment: "mallard" } },
      })
      .mockResolvedValueOnce({
        data: { id: 5, species_data: { name_lang: "Кряква", segment: "kryakva" } },
      });

    (useLanguage as jest.Mock).mockReturnValue({ language: "en" });
    const { result, rerender } = await renderHook(() => useObservationItem(5), { wrapper });
    await waitFor(() =>
      expect(result.current.data?.species_data?.name_lang).toBe("Mallard"),
    );

    (useLanguage as jest.Mock).mockReturnValue({ language: "ru" });
    await act(async () => {
      rerender({});
    });

    await waitFor(() =>
      expect(result.current.data?.species_data?.name_lang).toBe("Кряква"),
    );
    expect(result.current.data?.species_data?.segment).toBe("kryakva");
    expect(api.get).toHaveBeenCalledTimes(2);
  });
});

describe("useCreateObservation", () => {
  it("posts to the server and caches the result when online, for a diary-less observation", async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { id: 5 } });
    const { result } = await renderHook(() => useCreateObservation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ payload: { diary: null } as never });
    });

    expect(api.post).toHaveBeenCalledWith("/myapi/observation2/", {
      diary: null,
      client_request_id: "client-request-id",
    });
    expect(observationRepository.createLocal).not.toHaveBeenCalled();
  });

  it("falls back to a local draft and triggers sync when the server is unreachable", async () => {
    (api.post as jest.Mock).mockRejectedValue(networkError());
    (observationRepository.createLocal as jest.Mock).mockReturnValue({ id: -1 });
    const { result } = await renderHook(() => useCreateObservation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ payload: { diary: null } as never });
    });

    expect(observationRepository.createLocal).toHaveBeenCalledTimes(1);
    expect(runObservationSync).toHaveBeenCalledTimes(1);
  });

  it("does not toast a 400 validation error, but does toast other errors", async () => {
    (api.post as jest.Mock).mockRejectedValue(validationError());
    const { result: validationResult } = await renderHook(() => useCreateObservation(), { wrapper });
    await act(async () => {
      await expect(validationResult.current.mutateAsync({ payload: { diary: null } as never })).rejects.toThrow();
    });
    expect(mockShowErrorToast).not.toHaveBeenCalled();

    (api.post as jest.Mock).mockRejectedValue(Object.assign(new Error("server exploded"), { status: 500 }));
    const { result: serverResult } = await renderHook(() => useCreateObservation(), { wrapper });
    await act(async () => {
      await expect(serverResult.current.mutateAsync({ payload: { diary: null } as never })).rejects.toThrow();
    });
    expect(mockShowErrorToast).toHaveBeenCalledWith(expect.objectContaining({ message: "server exploded" }));
  });

  it("invalidates the Observation-related caches on settle", async () => {
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
    (api.post as jest.Mock).mockResolvedValue({ data: { id: 5 } });
    const { result } = await renderHook(() => useCreateObservation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ payload: { diary: null } as never });
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map((call) => call[0]?.queryKey);
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([["Observations"], ["Observation"], ["Diaries"], ["Stat"], ["Checklist"]]),
    );
  });
});

describe("useUpdateObservation", () => {
  it("rejects immediately when there's no id to update", async () => {
    const { result } = await renderHook(() => useUpdateObservation(null), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ payload: { diary: null } as never })).rejects.toThrow(
        "Missing observation id",
      );
    });
  });

  it("patches the server for an already-synced observation when online", async () => {
    (api.patch as jest.Mock).mockResolvedValue({ data: { id: 5 } });
    const { result } = await renderHook(() => useUpdateObservation(5), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ payload: { diary: null } as never });
    });

    expect(api.patch).toHaveBeenCalledWith("/myapi/observation2/5/", { diary: null });
    expect(observationRepository.updateLocal).not.toHaveBeenCalled();
  });

  it("updates locally and re-triggers sync when the patch fails over the network", async () => {
    (api.patch as jest.Mock).mockRejectedValue(networkError());
    (observationRepository.updateLocal as jest.Mock).mockReturnValue({ id: 5 });
    const { result } = await renderHook(() => useUpdateObservation(5), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ payload: { diary: null } as never });
    });

    expect(observationRepository.updateLocal).toHaveBeenCalledTimes(1);
    expect(runObservationSync).toHaveBeenCalledTimes(1);
  });
});

describe("useDeleteObservation", () => {
  it("deletes on the server for an already-synced observation when online", async () => {
    (api.delete as jest.Mock).mockResolvedValue({});
    const { result } = await renderHook(() => useDeleteObservation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(5);
    });

    expect(api.delete).toHaveBeenCalledWith("/myapi/observation2/5/");
    expect(observationRepository.removeLocal).toHaveBeenCalledWith(5);
  });

  it("deletes locally and re-triggers sync when the server delete fails over the network", async () => {
    (api.delete as jest.Mock).mockRejectedValue(networkError());
    const { result } = await renderHook(() => useDeleteObservation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(5);
    });

    expect(observationRepository.deleteLocal).toHaveBeenCalledWith(5);
    expect(runObservationSync).toHaveBeenCalledTimes(1);
  });

  it("deletes a still-local (never synced) observation without touching the network or sync", async () => {
    const { result } = await renderHook(() => useDeleteObservation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(-1);
    });

    expect(api.delete).not.toHaveBeenCalled();
    expect(observationRepository.deleteLocal).toHaveBeenCalledWith(-1);
    expect(runObservationSync).not.toHaveBeenCalled();
  });
});

describe("diary-scoped observation resolution (resolveObservationDiary, exercised via useCreateObservation)", () => {
  it("leaves a diary-less payload untouched and skips diary lookups entirely", async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { id: 5 } });
    const { result } = await renderHook(() => useCreateObservation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ payload: { diary: null } as never });
    });

    expect(diaryRepository.resolveDiaryId).not.toHaveBeenCalled();
    expect(diaryRepository.getDiary).not.toHaveBeenCalled();
    expect(api.post).toHaveBeenCalledWith("/myapi/observation2/", expect.objectContaining({ diary: null }));
  });

  it("proceeds online for an already-synced (positive) diary id, filling extras from it", async () => {
    (diaryRepository.getDiary as jest.Mock).mockReturnValue({
      territory: 5,
      place: 2,
      place_data: { id: 2 },
      date_time: "2026-01-01",
      private: true,
    });
    (api.post as jest.Mock).mockResolvedValue({ data: { id: 5 } });
    const { result } = await renderHook(() => useCreateObservation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ payload: { diary: 3 } as never });
    });

    expect(diaryRepository.resolveDiaryId).toHaveBeenCalledWith(3);
    expect(diaryRepository.getDiary).toHaveBeenCalledWith(3);
    expect(api.post).toHaveBeenCalledWith("/myapi/observation2/", expect.objectContaining({ diary: 3 }));
  });

  it("clears the diary field and proceeds normally when the parent diary was discarded before it ever synced", async () => {
    (diaryRepository.resolveDiaryId as jest.Mock).mockReturnValue(undefined);
    (api.post as jest.Mock).mockResolvedValue({ data: { id: 5 } });
    const { result } = await renderHook(() => useCreateObservation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ payload: { diary: -1 } as never });
    });

    expect(diaryRepository.getDiary).not.toHaveBeenCalled();
    expect(api.post).toHaveBeenCalledWith("/myapi/observation2/", expect.objectContaining({ diary: null }));
  });

  it("skips the online attempt entirely while the parent diary is still pending sync, going straight to a local draft", async () => {
    (diaryRepository.resolveDiaryId as jest.Mock).mockReturnValue(-1);
    (diaryRepository.getDiary as jest.Mock).mockReturnValue({
      territory: 5,
      place: null,
      place_data: null,
      date_time: "2026-01-01",
      private: false,
    });
    (observationRepository.createLocal as jest.Mock).mockReturnValue({ id: -2 });
    const { result } = await renderHook(() => useCreateObservation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ payload: { diary: -1 } as never });
    });

    expect(api.post).not.toHaveBeenCalled();
    expect(observationRepository.createLocal).toHaveBeenCalledWith(
      expect.objectContaining({ diary: -1 }),
      expect.objectContaining({ diaryTerritory: 5, diaryDateTime: "2026-01-01" }),
      PROFILE,
      "client-request-id",
    );
    expect(runObservationSync).toHaveBeenCalledTimes(1);
  });
});
