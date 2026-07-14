jest.mock("../../../util/fetches", () => ({
  patchAvatar: jest.fn(),
  deleteMyAvatar: jest.fn(),
}));
jest.mock("../../../hooks/repositories/profileRepository", () => ({
  failMutation: jest.fn(),
  getPendingAvatarMutation: jest.fn(),
  resolvePendingAvatar: jest.fn(),
}));
jest.mock("../networkStatus", () => ({
  isConnected: jest.fn(() => true),
}));
jest.mock("../profileSync", () => ({
  pullProfile: jest.fn(async () => {}),
}));

import { patchAvatar, deleteMyAvatar } from "../../../util/fetches";
import * as profileRepository from "../../../hooks/repositories/profileRepository";
import { isConnected } from "../networkStatus";
import { pullProfile } from "../profileSync";
import { runAvatarSync } from "../avatarSync";

const getPendingAvatarMutation = profileRepository.getPendingAvatarMutation as jest.Mock;
const resolvePendingAvatar = profileRepository.resolvePendingAvatar as jest.Mock;
const failMutation = profileRepository.failMutation as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (isConnected as jest.Mock).mockReturnValue(true);
  getPendingAvatarMutation.mockReturnValue(null);
});

it("does nothing while offline", async () => {
  (isConnected as jest.Mock).mockReturnValue(false);
  getPendingAvatarMutation.mockReturnValue({ id: 1, payload: { op: "upload", uri: "file://a.jpg" } });

  await runAvatarSync();

  expect(patchAvatar).not.toHaveBeenCalled();
});

it("does nothing when there is no pending avatar mutation", async () => {
  await runAvatarSync();
  expect(patchAvatar).not.toHaveBeenCalled();
  expect(deleteMyAvatar).not.toHaveBeenCalled();
});

it("uploads a pending avatar, resolves it with the thumbnail for both fields, and pulls the full profile best-effort", async () => {
  getPendingAvatarMutation.mockReturnValue({ id: 1, payload: { op: "upload", uri: "file://a.jpg" } });
  (patchAvatar as jest.Mock).mockResolvedValueOnce({ avatar_thumbnail: "thumb.jpg" });

  await runAvatarSync();

  expect(patchAvatar).toHaveBeenCalledWith({ uri: "file://a.jpg" });
  expect(resolvePendingAvatar).toHaveBeenCalledWith(1, {
    avatar: "thumb.jpg",
    avatarThumbnail: "thumb.jpg",
  });
  expect(pullProfile).toHaveBeenCalled();
});

it("deletes a pending avatar removal and resolves with empty strings", async () => {
  getPendingAvatarMutation.mockReturnValue({ id: 2, payload: { op: "delete", uri: null } });

  await runAvatarSync();

  expect(deleteMyAvatar).toHaveBeenCalled();
  expect(resolvePendingAvatar).toHaveBeenCalledWith(2, { avatar: "", avatarThumbnail: "" });
});

it("swallows a pullProfile failure after a successful upload (best-effort)", async () => {
  getPendingAvatarMutation.mockReturnValue({ id: 1, payload: { op: "upload", uri: "file://a.jpg" } });
  (patchAvatar as jest.Mock).mockResolvedValueOnce({ avatar_thumbnail: "thumb.jpg" });
  (pullProfile as jest.Mock).mockRejectedValueOnce(new Error("boom"));

  await expect(runAvatarSync()).resolves.toBeUndefined();
  expect(resolvePendingAvatar).toHaveBeenCalled();
});

it("on a network error: leaves the mutation pending for a later trigger, without failing it", async () => {
  getPendingAvatarMutation.mockReturnValue({ id: 1, payload: { op: "upload", uri: "file://a.jpg" } });
  (patchAvatar as jest.Mock).mockRejectedValueOnce({ isNetworkError: true, message: "Network Error" });

  await runAvatarSync();

  expect(failMutation).not.toHaveBeenCalled();
  expect(resolvePendingAvatar).not.toHaveBeenCalled();
});

it("on a real (non-network) error: fails the mutation", async () => {
  getPendingAvatarMutation.mockReturnValue({ id: 1, payload: { op: "upload", uri: "file://a.jpg" } });
  (patchAvatar as jest.Mock).mockRejectedValueOnce({
    isNetworkError: false,
    isTimeout: false,
    message: "Upload rejected",
  });

  await runAvatarSync();

  expect(failMutation).toHaveBeenCalledWith(1, "Upload rejected");
});
