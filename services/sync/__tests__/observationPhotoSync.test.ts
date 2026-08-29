// The photo queue is separate from the observation queue for one reason: a
// photo can only be sent once its observation has a real server id, and a
// photo that fails must fail on its own rather than dragging the whole
// observation into the error state. Both halves are what these tests cover.
jest.mock("../../../util/fetches", () => ({
  uploadObservationPhoto: jest.fn(),
  deleteObservationPhoto: jest.fn(),
}));
jest.mock("../../queryClient", () => ({
  queryClient: { invalidateQueries: jest.fn() },
}));
jest.mock("../../../hooks/repositories/observationRepository", () => ({
  resolveObservationId: jest.fn(),
}));
jest.mock("../../../hooks/repositories/observationPhotoRepository", () => ({
  claimNextMutation: jest.fn(),
  getPhotoRow: jest.fn(),
  resolveUpload: jest.fn(() => "file:///a.jpg"),
  resolveDelete: jest.fn(),
  discardPhoto: jest.fn(() => "file:///a.jpg"),
  restorePhoto: jest.fn(),
  requeuePendingMutation: jest.fn(),
  requeueFailedMutation: jest.fn(),
}));
jest.mock("../../../util/photoFiles", () => ({
  deleteLocalPhoto: jest.fn(async () => {}),
}));
jest.mock("../networkStatus", () => ({
  isConnected: jest.fn(() => true),
}));
jest.mock("../../../util/invalidationMap", () => ({
  INVALIDATION_MAP: { Observation: { update: [["Observations"]] } },
}));

import {
  uploadObservationPhoto,
  deleteObservationPhoto,
} from "../../../util/fetches";
import * as observationRepository from "../../../hooks/repositories/observationRepository";
import * as photoRepository from "../../../hooks/repositories/observationPhotoRepository";
import { deleteLocalPhoto } from "../../../util/photoFiles";
import { isConnected } from "../networkStatus";
import {
  runObservationPhotoSync,
  stopObservationPhotoSyncRetries,
} from "../observationPhotoSync";

const claimNextMutation = photoRepository.claimNextMutation as jest.Mock;
const getPhotoRow = photoRepository.getPhotoRow as jest.Mock;
const resolveUpload = photoRepository.resolveUpload as jest.Mock;
const resolveDelete = photoRepository.resolveDelete as jest.Mock;
const discardPhoto = photoRepository.discardPhoto as jest.Mock;
const restorePhoto = photoRepository.restorePhoto as jest.Mock;
const requeuePendingMutation = photoRepository.requeuePendingMutation as jest.Mock;
const requeueFailedMutation = photoRepository.requeueFailedMutation as jest.Mock;
const resolveObservationId = observationRepository.resolveObservationId as jest.Mock;
const upload = uploadObservationPhoto as jest.Mock;
const remove = deleteObservationPhoto as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (isConnected as jest.Mock).mockReturnValue(true);
  stopObservationPhotoSyncRetries();
});

afterEach(() => {
  jest.useRealTimers();
});

const mutation = (payload: unknown) => ({
  payload,
  createdAt: 1000,
  attempts: 0,
});

const uploadMutation = (observationLocalId = -1) =>
  mutation({ op: "upload", photoLocalId: -10, observationLocalId });

const deleteMutation = (observationLocalId = 55) =>
  mutation({ op: "delete", photoLocalId: -11, observationLocalId });

const uploadRow = {
  id: -10,
  observationId: -1,
  serverId: null,
  localUri: "file:///a.jpg",
  sortOrder: 0,
  clientRequestId: "req-1",
  op: "upload",
  status: "pending",
  lastError: null,
  createdAt: 1000,
};

const deleteRow = { ...uploadRow, id: -11, op: "delete", serverId: 900, localUri: null };

// mockReset, not just a chain of mockReturnValueOnce: a pass that returns
// early (the network-failure branch) leaves an unconsumed queued value behind,
// and jest.clearAllMocks does not drop those — the leftover would then be the
// first thing the next test claims.
const claimOnce = (m: ReturnType<typeof mutation>) => {
  claimNextMutation.mockReset();
  claimNextMutation.mockReturnValueOnce(m).mockReturnValue(null);
};

describe("upload", () => {
  it("sends the file once the observation has a real id and drops the local copy", async () => {
    claimOnce(uploadMutation());
    getPhotoRow.mockReturnValue(uploadRow);
    resolveObservationId.mockReturnValue(55);
    upload.mockResolvedValueOnce({ id: 900, image: "x.jpg", thumbnail: "t.jpg", sort_order: 0 });

    await runObservationPhotoSync();

    expect(upload).toHaveBeenCalledWith(55, "file:///a.jpg", 0, "req-1");
    expect(resolveUpload).toHaveBeenCalledWith(-10, [-1, 55], expect.objectContaining({ id: 900 }));
    expect(deleteLocalPhoto).toHaveBeenCalledWith("file:///a.jpg");
  });

  it("defers a photo whose observation has not synced yet instead of sending a temp id", async () => {
    claimOnce(uploadMutation());
    getPhotoRow.mockReturnValue(uploadRow);
    resolveObservationId.mockReturnValue(-1);
    jest.useFakeTimers();

    await runObservationPhotoSync();

    expect(upload).not.toHaveBeenCalled();
    expect(requeuePendingMutation).toHaveBeenCalledWith(
      expect.objectContaining({ op: "upload" }),
      1000,
      0,
    );
  });

  it("discards a photo whose observation can never resolve", async () => {
    claimOnce(uploadMutation());
    getPhotoRow.mockReturnValue(uploadRow);
    resolveObservationId.mockReturnValue(undefined);

    await runObservationPhotoSync();

    expect(upload).not.toHaveBeenCalled();
    expect(discardPhoto).toHaveBeenCalledWith(-10);
    expect(deleteLocalPhoto).toHaveBeenCalledWith("file:///a.jpg");
    expect(requeueFailedMutation).not.toHaveBeenCalled();
  });

  it("puts the mutation back and backs off on a network failure", async () => {
    claimOnce(uploadMutation());
    getPhotoRow.mockReturnValue(uploadRow);
    resolveObservationId.mockReturnValue(55);
    upload.mockRejectedValueOnce({ isNetworkError: true, message: "Network Error" });
    jest.useFakeTimers();

    await runObservationPhotoSync();

    expect(requeuePendingMutation).toHaveBeenCalled();
    expect(requeueFailedMutation).not.toHaveBeenCalled();
  });

  it("marks only the photo as failed on a real error", async () => {
    claimOnce(uploadMutation());
    getPhotoRow.mockReturnValue(uploadRow);
    resolveObservationId.mockReturnValue(55);
    upload.mockRejectedValueOnce({
      response: { status: 400 },
      message: "Photo limit reached",
    });

    await runObservationPhotoSync();

    expect(requeueFailedMutation).toHaveBeenCalledWith(
      expect.objectContaining({ op: "upload" }),
      1000,
      0,
      "Photo limit reached",
    );
    // The file stays: the user can retry it.
    expect(deleteLocalPhoto).not.toHaveBeenCalledWith("file:///a.jpg");
  });

  it("skips a mutation whose photo was removed locally in the meantime", async () => {
    claimOnce(uploadMutation());
    getPhotoRow.mockReturnValue(null);

    await runObservationPhotoSync();

    expect(upload).not.toHaveBeenCalled();
    expect(requeueFailedMutation).not.toHaveBeenCalled();
  });
});

describe("delete", () => {
  it("removes the photo on the server", async () => {
    claimOnce(deleteMutation());
    getPhotoRow.mockReturnValue(deleteRow);
    resolveObservationId.mockReturnValue(55);
    remove.mockResolvedValueOnce({});

    await runObservationPhotoSync();

    expect(remove).toHaveBeenCalledWith(900);
    expect(resolveDelete).toHaveBeenCalledWith(-11);
  });

  it("treats a 404 as success — the photo is already gone, which is the point", async () => {
    claimOnce(deleteMutation());
    getPhotoRow.mockReturnValue(deleteRow);
    resolveObservationId.mockReturnValue(55);
    remove.mockRejectedValueOnce({ response: { status: 404 }, message: "Not found" });

    await runObservationPhotoSync();

    expect(resolveDelete).toHaveBeenCalledWith(-11);
    expect(requeueFailedMutation).not.toHaveBeenCalled();
  });

  it("puts the photo back into the strip when the deletion really failed", async () => {
    claimOnce(deleteMutation());
    getPhotoRow.mockReturnValue(deleteRow);
    resolveObservationId.mockReturnValue(55);
    remove.mockRejectedValueOnce({ response: { status: 500 }, message: "Server error" });

    await runObservationPhotoSync();

    expect(restorePhoto).toHaveBeenCalledWith(55, expect.objectContaining({ id: 900 }));
    expect(requeueFailedMutation).toHaveBeenCalled();
  });
});

describe("offline", () => {
  it("does nothing at all while disconnected", async () => {
    (isConnected as jest.Mock).mockReturnValue(false);

    await runObservationPhotoSync();

    expect(claimNextMutation).not.toHaveBeenCalled();
  });
});
