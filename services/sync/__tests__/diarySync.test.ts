jest.mock("../../api", () => ({
  __esModule: true,
  default: { post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("../../queryClient", () => ({
  queryClient: { invalidateQueries: jest.fn() },
}));
jest.mock("../../../hooks/repositories/diaryRepository", () => ({
  claimNextMutation: jest.fn(),
  replaceLocalWithServer: jest.fn(),
  upsertFromServer: jest.fn(),
  removeLocal: jest.fn(),
  requeuePendingMutation: jest.fn(),
  requeueFailedMutation: jest.fn(),
}));
jest.mock("../../../hooks/repositories/placeRepository", () => ({
  resolvePlaceId: jest.fn(),
}));
jest.mock("../networkStatus", () => ({
  isConnected: jest.fn(() => true),
}));
jest.mock("../observationSync", () => ({
  runObservationSync: jest.fn(),
}));

import api from "../../api";
import { queryClient } from "../../queryClient";
import * as diaryRepository from "../../../hooks/repositories/diaryRepository";
import * as placeRepository from "../../../hooks/repositories/placeRepository";
import { isConnected } from "../networkStatus";
import { runObservationSync } from "../observationSync";
import { runDiarySync, stopDiarySyncRetries } from "../diarySync";

const claimNextMutation = diaryRepository.claimNextMutation as jest.Mock;
const replaceLocalWithServer = diaryRepository.replaceLocalWithServer as jest.Mock;
const upsertFromServer = diaryRepository.upsertFromServer as jest.Mock;
const removeLocal = diaryRepository.removeLocal as jest.Mock;
const requeuePendingMutation = diaryRepository.requeuePendingMutation as jest.Mock;
const requeueFailedMutation = diaryRepository.requeueFailedMutation as jest.Mock;
const resolvePlaceId = placeRepository.resolvePlaceId as jest.Mock;
const apiPost = api.post as jest.Mock;
const apiPatch = api.patch as jest.Mock;
const apiDelete = api.delete as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (isConnected as jest.Mock).mockReturnValue(true);
  stopDiarySyncRetries();
});

afterEach(() => {
  jest.useRealTimers();
});

const mutation = (payload: unknown, overrides: Partial<{ createdAt: number; attempts: number }> = {}) => ({
  payload,
  createdAt: overrides.createdAt ?? 1,
  attempts: overrides.attempts ?? 0,
});

describe("offline", () => {
  it("does nothing and never claims a mutation", async () => {
    (isConnected as jest.Mock).mockReturnValue(false);
    await runDiarySync();
    expect(claimNextMutation).not.toHaveBeenCalled();
  });
});

describe("create", () => {
  it("posts, replaces local with the server row, invalidates caches, and wakes observation sync", async () => {
    claimNextMutation
      .mockReturnValueOnce(
        mutation({ op: "create", localId: -1, data: { territory: 5 }, clientRequestId: "r1" }),
      )
      .mockReturnValueOnce(null);
    apiPost.mockResolvedValueOnce({ data: { id: 55, territory: 5 } });

    await runDiarySync();

    expect(apiPost).toHaveBeenCalledWith("/myapi/diary2/", {
      territory: 5,
      client_request_id: "r1",
    });
    expect(replaceLocalWithServer).toHaveBeenCalledWith(-1, { id: 55, territory: 5 });
    expect(queryClient.invalidateQueries).toHaveBeenCalled();
    expect(runObservationSync).toHaveBeenCalled();
  });

  it("resolves a negative place id before sending when the place has since synced", async () => {
    claimNextMutation
      .mockReturnValueOnce(
        mutation({ op: "create", localId: -1, data: { territory: 5, place: -99 }, clientRequestId: "r1" }),
      )
      .mockReturnValueOnce(null);
    resolvePlaceId.mockReturnValueOnce(42);
    apiPost.mockResolvedValueOnce({ data: { id: 55 } });

    await runDiarySync();

    expect(resolvePlaceId).toHaveBeenCalledWith(-99);
    expect(apiPost).toHaveBeenCalledWith(
      "/myapi/diary2/",
      expect.objectContaining({ place: 42 }),
    );
  });

  it("defers (does not send) a mutation whose place hasn't synced yet, then requeues it for the next pass", async () => {
    claimNextMutation
      .mockReturnValueOnce(
        mutation({ op: "create", localId: -1, data: { territory: 5, place: -99 }, clientRequestId: "r1" }),
      )
      .mockReturnValueOnce(null);
    resolvePlaceId.mockReturnValueOnce(-99);

    await runDiarySync();

    expect(apiPost).not.toHaveBeenCalled();
    expect(claimNextMutation).toHaveBeenCalledTimes(2);
    expect(requeuePendingMutation).toHaveBeenCalledWith(
      expect.objectContaining({ localId: -1 }),
      1,
      0,
    );
  });

  it("fails outright a mutation whose parent place was discarded before it ever synced", async () => {
    claimNextMutation
      .mockReturnValueOnce(
        mutation({ op: "create", localId: -1, data: { territory: 5, place: -99 }, clientRequestId: "r1" }),
      )
      .mockReturnValueOnce(null);
    resolvePlaceId.mockReturnValueOnce(undefined);

    await runDiarySync();

    expect(apiPost).not.toHaveBeenCalled();
    expect(requeueFailedMutation).toHaveBeenCalledWith(
      expect.objectContaining({ localId: -1 }),
      1,
      0,
      -1,
      "Parent place was removed before it ever synced",
    );
    expect(queryClient.invalidateQueries).toHaveBeenCalled();
  });
});

describe("update", () => {
  it("patches and upserts the server response", async () => {
    claimNextMutation
      .mockReturnValueOnce(mutation({ op: "update", localId: 777, data: { name: "Renamed" } }))
      .mockReturnValueOnce(null);
    apiPatch.mockResolvedValueOnce({ data: { id: 777, name: "Renamed" } });

    await runDiarySync();

    expect(apiPatch).toHaveBeenCalledWith("/myapi/diary2/777/", { name: "Renamed" });
    expect(upsertFromServer).toHaveBeenCalledWith({ id: 777, name: "Renamed" });
  });
});

describe("delete", () => {
  it("deletes on the server and removes the local row", async () => {
    claimNextMutation
      .mockReturnValueOnce(mutation({ op: "delete", localId: 777 }))
      .mockReturnValueOnce(null);
    apiDelete.mockResolvedValueOnce({});

    await runDiarySync();

    expect(apiDelete).toHaveBeenCalledWith("/myapi/diary2/777/");
    expect(removeLocal).toHaveBeenCalledWith(777);
  });
});

describe("failure handling", () => {
  it("on a network error: requeues the mutation and stops the pass early without claiming more", async () => {
    claimNextMutation.mockReturnValueOnce(
      mutation({ op: "create", localId: -1, data: { territory: 5 }, clientRequestId: "r1" }),
    );
    apiPost.mockRejectedValueOnce({ isNetworkError: true, message: "Network Error" });

    await runDiarySync();

    expect(requeuePendingMutation).toHaveBeenCalledWith(
      expect.objectContaining({ localId: -1 }),
      1,
      0,
    );
    expect(requeueFailedMutation).not.toHaveBeenCalled();
    expect(claimNextMutation).toHaveBeenCalledTimes(1);
  });

  it("on a real (non-network) error: fails just that mutation and continues to the next one", async () => {
    claimNextMutation
      .mockReturnValueOnce(
        mutation({ op: "create", localId: -1, data: { territory: 5 }, clientRequestId: "r1" }),
      )
      .mockReturnValueOnce(
        mutation({ op: "create", localId: -2, data: { territory: 5 }, clientRequestId: "r2" }, { createdAt: 2 }),
      )
      .mockReturnValueOnce(null);
    apiPost
      .mockRejectedValueOnce({ isNetworkError: false, isTimeout: false, message: "Validation error" })
      .mockResolvedValueOnce({ data: { id: 60 } });

    await runDiarySync();

    expect(requeueFailedMutation).toHaveBeenCalledWith(
      expect.objectContaining({ localId: -1 }),
      1,
      0,
      -1,
      "Validation error",
    );
    expect(replaceLocalWithServer).toHaveBeenCalledWith(-2, { id: 60 });
    expect(claimNextMutation).toHaveBeenCalledTimes(3);
  });
});

describe("concurrency", () => {
  it("dedupes overlapping calls: a second call while one is in flight doesn't claim again", async () => {
    let resolvePost!: (value: { data: { id: number } }) => void;
    apiPost.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePost = resolve;
      }),
    );
    claimNextMutation
      .mockReturnValueOnce(
        mutation({ op: "create", localId: -1, data: { territory: 5 }, clientRequestId: "r1" }),
      )
      .mockReturnValue(null);

    const first = runDiarySync();
    const second = runDiarySync();

    expect(claimNextMutation).toHaveBeenCalledTimes(1);

    resolvePost({ data: { id: 1 } });
    await first;
    await second;
  });
});

describe("stopDiarySyncRetries", () => {
  it("cancels a scheduled backoff retry so it never fires", async () => {
    jest.useFakeTimers();
    claimNextMutation.mockReturnValueOnce(
      mutation({ op: "create", localId: -1, data: { territory: 5 }, clientRequestId: "r1" }),
    );
    apiPost.mockRejectedValueOnce({ isNetworkError: true, message: "boom" });

    await runDiarySync();
    expect(claimNextMutation).toHaveBeenCalledTimes(1);

    stopDiarySyncRetries();
    jest.advanceTimersByTime(60_000);

    expect(claimNextMutation).toHaveBeenCalledTimes(1);
  });
});
