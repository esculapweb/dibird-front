import { fetchMyProfile, updateMyProfile } from "../../util/fetches";
import { AppError, ProfileFormData } from "../../types";
import {
  failMutation,
  getPendingMutations,
  resolveMutation,
  upsertProfileFromServer,
} from "../../hooks/repositories/profileRepository";
import { isConnected } from "./networkStatus";

export const pullProfile = async () => {
  if (!isConnected()) return;
  if (getPendingMutations().length > 0) return;
  const data = await fetchMyProfile();
  upsertProfileFromServer(data);
};

export const pushPending = async () => {
  if (!isConnected()) return;

  const pending = getPendingMutations();

  for (const mutation of pending) {
    try {
      const data = await updateMyProfile(
        mutation.payload as Partial<ProfileFormData>,
      );
      upsertProfileFromServer(data);
      resolveMutation(mutation.id);
    } catch (e) {
      const error = e as AppError;
      if (error.isNetworkError || error.isTimeout) return;
      failMutation(mutation.id, error.message);
      throw error;
    }
  }
};

export const runProfileSync = async () => {
  try {
    await pushPending();
  } catch (e) {
    const error = e as AppError;
    if (error.isNetworkError || error.isTimeout) return;
    throw error;
  }

  try {
    await pullProfile();
  } catch {
    // best-effort reconciliation after a successful push; a later trigger retries
  }
};
