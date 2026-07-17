jest.mock("../../api", () => ({
  __esModule: true,
  default: { post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("../../queryClient", () => ({
  queryClient: { invalidateQueries: jest.fn() },
}));
jest.mock("../../../hooks/repositories/observationRepository", () => ({
  claimNextMutation: jest.fn(),
  replaceLocalWithServer: jest.fn(),
  upsertFromServer: jest.fn(),
  removeLocal: jest.fn(),
  requeuePendingMutation: jest.fn(),
  requeueFailedMutation: jest.fn(),
}));
jest.mock("../../../hooks/repositories/diaryRepository", () => ({
  resolveDiaryId: jest.fn(),
}));
jest.mock("../../../hooks/repositories/placeRepository", () => ({
  resolvePlaceId: jest.fn(),
}));
jest.mock("../networkStatus", () => ({
  isConnected: jest.fn(() => true),
}));
jest.mock("../../../util/invalidationMap", () => ({
  INVALIDATION_MAP: { Observation: { update: [["Observations"]] } },
}));

import api from "../../api";
import { queryClient } from "../../queryClient";
import * as observationRepository from "../../../hooks/repositories/observationRepository";
import * as diaryRepository from "../../../hooks/repositories/diaryRepository";
import * as placeRepository from "../../../hooks/repositories/placeRepository";
import { isConnected } from "../networkStatus";
import { runObservationSync, stopObservationSyncRetries } from "../observationSync";

const claimNextMutation = observationRepository.claimNextMutation as jest.Mock;
const replaceLocalWithServer = observationRepository.replaceLocalWithServer as jest.Mock;
const upsertFromServer = observationRepository.upsertFromServer as jest.Mock;
const removeLocal = observationRepository.removeLocal as jest.Mock;
const requeuePendingMutation = observationRepository.requeuePendingMutation as jest.Mock;
const requeueFailedMutation = observationRepository.requeueFailedMutation as jest.Mock;
const resolveDiaryId = diaryRepository.resolveDiaryId as jest.Mock;
const resolvePlaceId = placeRepository.resolvePlaceId as jest.Mock;
const apiPost = api.post as jest.Mock;
const apiPatch = api.patch as jest.Mock;
const apiDelete = api.delete as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (isConnected as jest.Mock).mockReturnValue(true);
  stopObservationSyncRetries();
});

afterEach(() => {
  jest.useRealTimers();
});

const mutation = (payload: unknown, overrides: Partial<{ createdAt: number; attempts: number }> = {}) => ({
  payload,
  createdAt: overrides.createdAt ?? 1,
  attempts: overrides.attempts ?? 0,
});

describe("create", () => {
  it("posts, replaces local with the server row, and invalidates caches", async () => {
    claimNextMutation
      .mockReturnValueOnce(
        mutation({ op: "create", localId: -1, data: { species: 100 }, clientRequestId: "r1" }),
      )
      .mockReturnValueOnce(null);
    apiPost.mockResolvedValueOnce({ data: { id: 55, species: 100 } });

    await runObservationSync();

    expect(apiPost).toHaveBeenCalledWith("/myapi/observation2/", {
      species: 100,
      client_request_id: "r1",
    });
    expect(replaceLocalWithServer).toHaveBeenCalledWith(-1, { id: 55, species: 100 });
    expect(queryClient.invalidateQueries).toHaveBeenCalled();
  });

  it("resolves both a negative diary id and a negative place id before sending", async () => {
    claimNextMutation
      .mockReturnValueOnce(
        mutation({
          op: "create",
          localId: -1,
          data: { species: 100, diary: -50, place: -99 },
          clientRequestId: "r1",
        }),
      )
      .mockReturnValueOnce(null);
    resolveDiaryId.mockReturnValueOnce(500);
    resolvePlaceId.mockReturnValueOnce(42);
    apiPost.mockResolvedValueOnce({ data: { id: 55 } });

    await runObservationSync();

    expect(resolveDiaryId).toHaveBeenCalledWith(-50);
    expect(resolvePlaceId).toHaveBeenCalledWith(-99);
    expect(apiPost).toHaveBeenCalledWith(
      "/myapi/observation2/",
      expect.objectContaining({ diary: 500, place: 42 }),
    );
  });

  it("defers a mutation whose parent diary hasn't synced yet, then requeues it", async () => {
    claimNextMutation
      .mockReturnValueOnce(
        mutation({ op: "create", localId: -1, data: { species: 100, diary: -50 }, clientRequestId: "r1" }),
      )
      .mockReturnValueOnce(null);
    resolveDiaryId.mockReturnValueOnce(-50);

    await runObservationSync();

    expect(apiPost).not.toHaveBeenCalled();
    expect(requeuePendingMutation).toHaveBeenCalledWith(
      expect.objectContaining({ localId: -1 }),
      1,
      0,
    );
  });

  it("fails outright a mutation whose parent diary was discarded before it ever synced", async () => {
    claimNextMutation
      .mockReturnValueOnce(
        mutation({ op: "create", localId: -1, data: { species: 100, diary: -50 }, clientRequestId: "r1" }),
      )
      .mockReturnValueOnce(null);
    resolveDiaryId.mockReturnValueOnce(undefined);

    await runObservationSync();

    expect(apiPost).not.toHaveBeenCalled();
    expect(requeueFailedMutation).toHaveBeenCalledWith(
      expect.objectContaining({ localId: -1 }),
      1,
      0,
      -1,
      "Parent diary could not be synced",
    );
  });

  it("fails outright a mutation whose parent place was discarded before it ever synced", async () => {
    claimNextMutation
      .mockReturnValueOnce(
        mutation({ op: "create", localId: -1, data: { species: 100, place: -99 }, clientRequestId: "r1" }),
      )
      .mockReturnValueOnce(null);
    resolvePlaceId.mockReturnValueOnce(undefined);

    await runObservationSync();

    expect(apiPost).not.toHaveBeenCalled();
    expect(requeueFailedMutation).toHaveBeenCalledWith(
      expect.objectContaining({ localId: -1 }),
      1,
      0,
      -1,
      "Parent place could not be synced",
    );
  });
});

describe("update", () => {
  it("patches and upserts the server response", async () => {
    claimNextMutation
      .mockReturnValueOnce(mutation({ op: "update", localId: 777, data: { quantity: 3 } }))
      .mockReturnValueOnce(null);
    apiPatch.mockResolvedValueOnce({ data: { id: 777, quantity: 3 } });

    await runObservationSync();

    expect(apiPatch).toHaveBeenCalledWith("/myapi/observation2/777/", { quantity: 3 });
    expect(upsertFromServer).toHaveBeenCalledWith({ id: 777, quantity: 3 });
  });
});

describe("delete", () => {
  it("deletes on the server and removes the local row", async () => {
    claimNextMutation
      .mockReturnValueOnce(mutation({ op: "delete", localId: 777 }))
      .mockReturnValueOnce(null);
    apiDelete.mockResolvedValueOnce({});

    await runObservationSync();

    expect(apiDelete).toHaveBeenCalledWith("/myapi/observation2/777/");
    expect(removeLocal).toHaveBeenCalledWith(777);
  });
});

describe("failure handling", () => {
  it("on a network error: requeues and stops the pass early", async () => {
    claimNextMutation.mockReturnValueOnce(
      mutation({ op: "create", localId: -1, data: { species: 100 }, clientRequestId: "r1" }),
    );
    apiPost.mockRejectedValueOnce({ isNetworkError: true, message: "Network Error" });

    await runObservationSync();

    expect(requeuePendingMutation).toHaveBeenCalledWith(
      expect.objectContaining({ localId: -1 }),
      1,
      0,
    );
    expect(claimNextMutation).toHaveBeenCalledTimes(1);
  });

  it("on a real (non-network) error: fails just that mutation and continues", async () => {
    claimNextMutation
      .mockReturnValueOnce(
        mutation({ op: "create", localId: -1, data: { species: 100 }, clientRequestId: "r1" }),
      )
      .mockReturnValueOnce(
        mutation({ op: "create", localId: -2, data: { species: 100 }, clientRequestId: "r2" }, { createdAt: 2 }),
      )
      .mockReturnValueOnce(null);
    apiPost
      .mockRejectedValueOnce({ isNetworkError: false, isTimeout: false, message: "Validation error" })
      .mockResolvedValueOnce({ data: { id: 60 } });

    await runObservationSync();

    expect(requeueFailedMutation).toHaveBeenCalledWith(
      expect.objectContaining({ localId: -1 }),
      1,
      0,
      -1,
      "Validation error",
    );
    expect(replaceLocalWithServer).toHaveBeenCalledWith(-2, { id: 60 });
  });
});

describe("stopObservationSyncRetries", () => {
  it("cancels a scheduled backoff retry so it never fires", async () => {
    jest.useFakeTimers();
    claimNextMutation.mockReturnValueOnce(
      mutation({ op: "create", localId: -1, data: { species: 100 }, clientRequestId: "r1" }),
    );
    apiPost.mockRejectedValueOnce({ isNetworkError: true, message: "boom" });

    await runObservationSync();
    expect(claimNextMutation).toHaveBeenCalledTimes(1);

    stopObservationSyncRetries();
    jest.advanceTimersByTime(60_000);

    expect(claimNextMutation).toHaveBeenCalledTimes(1);
  });
});
