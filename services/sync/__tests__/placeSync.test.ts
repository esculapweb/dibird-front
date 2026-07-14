jest.mock("../../api", () => ({
  __esModule: true,
  default: { post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("../../queryClient", () => ({
  queryClient: { invalidateQueries: jest.fn() },
}));
jest.mock("../../../hooks/repositories/placeRepository", () => ({
  claimNextMutation: jest.fn(),
  replaceLocalWithServer: jest.fn(),
  upsertFromServer: jest.fn(),
  removeLocal: jest.fn(),
  requeuePendingMutation: jest.fn(),
  requeueFailedMutation: jest.fn(),
}));
jest.mock("../networkStatus", () => ({
  isConnected: jest.fn(() => true),
}));
jest.mock("../observationSync", () => ({
  runObservationSync: jest.fn(),
}));
jest.mock("../diarySync", () => ({
  runDiarySync: jest.fn(),
}));
jest.mock("../../../util/invalidationMap", () => ({
  INVALIDATION_MAP: { Place: { update: [["Places"]] } },
}));

import api from "../../api";
import { queryClient } from "../../queryClient";
import * as placeRepository from "../../../hooks/repositories/placeRepository";
import { isConnected } from "../networkStatus";
import { runObservationSync } from "../observationSync";
import { runDiarySync } from "../diarySync";
import { runPlaceSync, stopPlaceSyncRetries } from "../placeSync";

const claimNextMutation = placeRepository.claimNextMutation as jest.Mock;
const replaceLocalWithServer = placeRepository.replaceLocalWithServer as jest.Mock;
const upsertFromServer = placeRepository.upsertFromServer as jest.Mock;
const removeLocal = placeRepository.removeLocal as jest.Mock;
const requeuePendingMutation = placeRepository.requeuePendingMutation as jest.Mock;
const requeueFailedMutation = placeRepository.requeueFailedMutation as jest.Mock;
const apiPost = api.post as jest.Mock;
const apiPatch = api.patch as jest.Mock;
const apiDelete = api.delete as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (isConnected as jest.Mock).mockReturnValue(true);
  stopPlaceSyncRetries();
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
    await runPlaceSync();
    expect(claimNextMutation).not.toHaveBeenCalled();
  });
});

describe("create", () => {
  it("posts, replaces local with the server row, invalidates caches, and wakes both observation and diary sync", async () => {
    claimNextMutation
      .mockReturnValueOnce(
        mutation({ op: "create", localId: -1, data: { name: "My spot" }, clientRequestId: "r1" }),
      )
      .mockReturnValueOnce(null);
    apiPost.mockResolvedValueOnce({ data: { id: 55, name: "My spot" } });

    await runPlaceSync();

    expect(apiPost).toHaveBeenCalledWith("/myapi/place2/", {
      name: "My spot",
      client_request_id: "r1",
    });
    expect(replaceLocalWithServer).toHaveBeenCalledWith(-1, { id: 55, name: "My spot" });
    expect(queryClient.invalidateQueries).toHaveBeenCalled();
    expect(runObservationSync).toHaveBeenCalled();
    expect(runDiarySync).toHaveBeenCalled();
  });
});

describe("update", () => {
  it("patches and upserts the server response, without waking dependent queues", async () => {
    claimNextMutation
      .mockReturnValueOnce(mutation({ op: "update", localId: 777, data: { favourite: true } }))
      .mockReturnValueOnce(null);
    apiPatch.mockResolvedValueOnce({ data: { id: 777, favourite: true } });

    await runPlaceSync();

    expect(apiPatch).toHaveBeenCalledWith("/myapi/place2/777/", { favourite: true });
    expect(upsertFromServer).toHaveBeenCalledWith({ id: 777, favourite: true });
    expect(runObservationSync).not.toHaveBeenCalled();
    expect(runDiarySync).not.toHaveBeenCalled();
  });
});

describe("delete", () => {
  it("deletes on the server and removes the local row", async () => {
    claimNextMutation
      .mockReturnValueOnce(mutation({ op: "delete", localId: 777 }))
      .mockReturnValueOnce(null);
    apiDelete.mockResolvedValueOnce({});

    await runPlaceSync();

    expect(apiDelete).toHaveBeenCalledWith("/myapi/place2/777/");
    expect(removeLocal).toHaveBeenCalledWith(777);
  });
});

describe("failure handling", () => {
  it("on a network error: requeues the mutation and stops the pass early", async () => {
    claimNextMutation.mockReturnValueOnce(
      mutation({ op: "create", localId: -1, data: { name: "My spot" }, clientRequestId: "r1" }),
    );
    apiPost.mockRejectedValueOnce({ isNetworkError: true, message: "Network Error" });

    await runPlaceSync();

    expect(requeuePendingMutation).toHaveBeenCalledWith(
      expect.objectContaining({ localId: -1 }),
      1,
      0,
    );
    expect(claimNextMutation).toHaveBeenCalledTimes(1);
  });

  it("on a real (non-network) error: fails just that mutation and continues to the next one", async () => {
    claimNextMutation
      .mockReturnValueOnce(
        mutation({ op: "create", localId: -1, data: { name: "A" }, clientRequestId: "r1" }),
      )
      .mockReturnValueOnce(
        mutation({ op: "create", localId: -2, data: { name: "B" }, clientRequestId: "r2" }, { createdAt: 2 }),
      )
      .mockReturnValueOnce(null);
    apiPost
      .mockRejectedValueOnce({ isNetworkError: false, isTimeout: false, message: "Validation error" })
      .mockResolvedValueOnce({ data: { id: 60 } });

    await runPlaceSync();

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

describe("stopPlaceSyncRetries", () => {
  it("cancels a scheduled backoff retry so it never fires", async () => {
    jest.useFakeTimers();
    claimNextMutation.mockReturnValueOnce(
      mutation({ op: "create", localId: -1, data: { name: "A" }, clientRequestId: "r1" }),
    );
    apiPost.mockRejectedValueOnce({ isNetworkError: true, message: "boom" });

    await runPlaceSync();
    expect(claimNextMutation).toHaveBeenCalledTimes(1);

    stopPlaceSyncRetries();
    jest.advanceTimersByTime(60_000);

    expect(claimNextMutation).toHaveBeenCalledTimes(1);
  });
});
