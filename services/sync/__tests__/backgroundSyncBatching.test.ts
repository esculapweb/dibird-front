// Reproduces the real trigger pattern behind the invalidation-storm bug:
// reconnect fires useObservationSync/useDiarySync/usePlaceSync independently
// (see hooks/*/use*Sync.ts), each calling its own run*Sync() at roughly the
// same time. Unlike observationSync.test.ts/diarySync.test.ts/placeSync.test.ts
// (which mock each other's sync module out), this test lets the real
// observationSync/diarySync/placeSync/syncBatch modules run together so it can
// assert on the thing those per-module tests can't see: a key requested by
// more than one module (e.g. ["Places"] from both place and diary, ["Diaries"]
// from both diary and observation) is invalidated once for the whole
// cross-module cascade, not once per module.
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
  resolvePlaceId: jest.fn(),
}));
jest.mock("../../../hooks/repositories/diaryRepository", () => ({
  claimNextMutation: jest.fn(),
  replaceLocalWithServer: jest.fn(),
  upsertFromServer: jest.fn(),
  removeLocal: jest.fn(),
  requeuePendingMutation: jest.fn(),
  requeueFailedMutation: jest.fn(),
  resolveDiaryId: jest.fn(),
}));
jest.mock("../../../hooks/repositories/observationRepository", () => ({
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
// A minimal map with deliberately overlapping keys across entities (mirrors
// the real util/invalidationMap.ts, where e.g. Observations/Diaries/Places
// all show up in more than one entity's list) — small enough to assert on
// directly instead of the real ~16-key lists.
jest.mock("../../../util/invalidationMap", () => ({
  INVALIDATION_MAP: {
    Place: { update: [["Places"]] },
    Diary: { update: [["Diaries"], ["Places"]] },
    Observation: { update: [["Observations"], ["Diaries"]] },
  },
}));

import api from "../../api";
import { queryClient } from "../../queryClient";
import * as placeRepository from "../../../hooks/repositories/placeRepository";
import * as diaryRepository from "../../../hooks/repositories/diaryRepository";
import * as observationRepository from "../../../hooks/repositories/observationRepository";
import { runPlaceSync, stopPlaceSyncRetries } from "../placeSync";
import { runDiarySync, stopDiarySyncRetries } from "../diarySync";
import { runObservationSync, stopObservationSyncRetries } from "../observationSync";

const apiPost = api.post as jest.Mock;
const invalidateQueries = queryClient.invalidateQueries as jest.Mock;

const mutation = (payload: unknown) => ({ payload, createdAt: 1, attempts: 0 });

beforeEach(() => {
  jest.clearAllMocks();
  stopPlaceSyncRetries();
  stopDiarySyncRetries();
  stopObservationSyncRetries();

  apiPost.mockImplementation((url: string) => {
    if (url.includes("place2")) return Promise.resolve({ data: { id: 201 } });
    if (url.includes("diary2")) return Promise.resolve({ data: { id: 202 } });
    return Promise.resolve({ data: { id: 203 } });
  });

  (placeRepository.claimNextMutation as jest.Mock)
    .mockReturnValueOnce(
      mutation({ op: "create", localId: -1, data: { name: "Spot" }, clientRequestId: "p1" }),
    )
    .mockReturnValue(null);
  (diaryRepository.claimNextMutation as jest.Mock)
    .mockReturnValueOnce(
      mutation({ op: "create", localId: -2, data: { territory: 5, place: 10 }, clientRequestId: "d1" }),
    )
    .mockReturnValue(null);
  (observationRepository.claimNextMutation as jest.Mock)
    .mockReturnValueOnce(
      mutation({ op: "create", localId: -3, data: { species: 100 }, clientRequestId: "o1" }),
    )
    .mockReturnValue(null);
});

it("invalidates a key shared by several sync modules once, not once per module", async () => {
  // Mirrors reconnect firing useObservationSync/useDiarySync/usePlaceSync
  // independently and near-simultaneously.
  await Promise.all([runPlaceSync(), runDiarySync(), runObservationSync()]);

  const callsFor = (key: string) =>
    invalidateQueries.mock.calls.filter(([arg]) => arg.queryKey[0] === key);

  // ["Places"] is in both Place.update and Diary.update; ["Diaries"] is in
  // both Diary.update and Observation.update. Each must appear exactly once
  // across the whole batch despite being requested by two modules.
  expect(callsFor("Places")).toHaveLength(1);
  expect(callsFor("Diaries")).toHaveLength(1);
  expect(callsFor("Observations")).toHaveLength(1);
});
