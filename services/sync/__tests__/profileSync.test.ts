jest.mock("../../../util/fetches", () => ({
  fetchMyProfile: jest.fn(),
  updateMyProfile: jest.fn(),
}));
jest.mock("../../../hooks/repositories/profileRepository", () => ({
  failMutation: jest.fn(),
  getPendingMutations: jest.fn(() => []),
  resolveMutation: jest.fn(),
  upsertProfileFromServer: jest.fn(),
}));
jest.mock("../networkStatus", () => ({
  isConnected: jest.fn(() => true),
}));

import { fetchMyProfile, updateMyProfile } from "../../../util/fetches";
import * as profileRepository from "../../../hooks/repositories/profileRepository";
import { isConnected } from "../networkStatus";
import { pullProfile, pushPending, runProfileSync } from "../profileSync";

const getPendingMutations = profileRepository.getPendingMutations as jest.Mock;
const resolveMutation = profileRepository.resolveMutation as jest.Mock;
const failMutation = profileRepository.failMutation as jest.Mock;
const upsertProfileFromServer = profileRepository.upsertProfileFromServer as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (isConnected as jest.Mock).mockReturnValue(true);
  getPendingMutations.mockReturnValue([]);
});

describe("pushPending", () => {
  it("does nothing while offline", async () => {
    (isConnected as jest.Mock).mockReturnValue(false);
    getPendingMutations.mockReturnValue([{ id: 1, payload: { first_name: "Jane" } }]);

    await pushPending();

    expect(updateMyProfile).not.toHaveBeenCalled();
  });

  it("pushes every pending mutation in order, upserting and resolving each one", async () => {
    getPendingMutations.mockReturnValue([
      { id: 1, payload: { first_name: "Jane" } },
      { id: 2, payload: { last_name: "Doe" } },
    ]);
    (updateMyProfile as jest.Mock)
      .mockResolvedValueOnce({ user: 1, user_data: { first_name: "Jane" } })
      .mockResolvedValueOnce({ user: 1, user_data: { last_name: "Doe" } });

    await pushPending();

    expect(updateMyProfile).toHaveBeenNthCalledWith(1, { first_name: "Jane" });
    expect(updateMyProfile).toHaveBeenNthCalledWith(2, { last_name: "Doe" });
    expect(upsertProfileFromServer).toHaveBeenCalledTimes(2);
    expect(resolveMutation).toHaveBeenNthCalledWith(1, 1);
    expect(resolveMutation).toHaveBeenNthCalledWith(2, 2);
  });

  it("on a network error: stops the loop without failing the mutation or throwing", async () => {
    getPendingMutations.mockReturnValue([
      { id: 1, payload: { first_name: "Jane" } },
      { id: 2, payload: { last_name: "Doe" } },
    ]);
    (updateMyProfile as jest.Mock).mockRejectedValueOnce({
      isNetworkError: true,
      message: "Network Error",
    });

    await expect(pushPending()).resolves.toBeUndefined();

    expect(updateMyProfile).toHaveBeenCalledTimes(1);
    expect(failMutation).not.toHaveBeenCalled();
    expect(resolveMutation).not.toHaveBeenCalled();
  });

  it("on a real (non-network) error: fails the mutation and rethrows", async () => {
    getPendingMutations.mockReturnValue([{ id: 1, payload: { first_name: "Jane" } }]);
    (updateMyProfile as jest.Mock).mockRejectedValueOnce({
      isNetworkError: false,
      isTimeout: false,
      message: "Validation error",
    });

    await expect(pushPending()).rejects.toMatchObject({ message: "Validation error" });

    expect(failMutation).toHaveBeenCalledWith(1, "Validation error");
  });
});

describe("pullProfile", () => {
  it("does nothing while offline", async () => {
    (isConnected as jest.Mock).mockReturnValue(false);
    await pullProfile();
    expect(fetchMyProfile).not.toHaveBeenCalled();
  });

  it("skips the pull if a local edit is still pending, to avoid clobbering it", async () => {
    getPendingMutations.mockReturnValue([{ id: 1, payload: {} }]);
    await pullProfile();
    expect(fetchMyProfile).not.toHaveBeenCalled();
  });

  it("fetches and upserts when online with nothing pending", async () => {
    (fetchMyProfile as jest.Mock).mockResolvedValueOnce({ user: 1 });
    await pullProfile();
    expect(upsertProfileFromServer).toHaveBeenCalledWith({ user: 1 });
  });
});

describe("runProfileSync", () => {
  it("pushes pending edits then pulls the latest profile", async () => {
    getPendingMutations.mockReturnValue([]);
    (fetchMyProfile as jest.Mock).mockResolvedValueOnce({ user: 1 });

    await runProfileSync();

    expect(fetchMyProfile).toHaveBeenCalled();
  });

  it("propagates a real push error and skips the pull entirely", async () => {
    getPendingMutations.mockReturnValue([{ id: 1, payload: { first_name: "Jane" } }]);
    (updateMyProfile as jest.Mock).mockRejectedValueOnce({
      isNetworkError: false,
      isTimeout: false,
      message: "Validation error",
    });

    await expect(runProfileSync()).rejects.toMatchObject({ message: "Validation error" });

    expect(fetchMyProfile).not.toHaveBeenCalled();
  });

  it("swallows a pull failure as best-effort after a successful push", async () => {
    getPendingMutations.mockReturnValue([]);
    (fetchMyProfile as jest.Mock).mockRejectedValueOnce(new Error("boom"));

    await expect(runProfileSync()).resolves.toBeUndefined();
  });
});
