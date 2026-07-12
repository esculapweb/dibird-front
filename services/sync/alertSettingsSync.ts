import { getAlertSettings, updateAlertSettings } from "../alertSettings";
import { AppError } from "../../types";
import {
  AlertSettingsMutationPayload,
  failMutation,
  getPendingMutations,
  resolveMutation,
  upsertFromServer,
} from "../../hooks/repositories/alertSettingsRepository";
import { isConnected } from "./networkStatus";

// Mirrors profileSync.ts's pullProfile/pushPending/runProfileSync shape — a
// single server-owned settings object patched in place, not a list of
// create/update/delete-able entities, so no backoff/atomic-claim machinery is
// needed the way diary/place/observation/notification use.

export const pullAlertSettings = async () => {
  if (!isConnected()) return;
  if (getPendingMutations().length > 0) return;
  const { data } = await getAlertSettings();
  upsertFromServer(data);
};

export const pushPending = async () => {
  if (!isConnected()) return;

  const pending = getPendingMutations();

  for (const mutation of pending) {
    try {
      const { patch, sync } = mutation.payload as AlertSettingsMutationPayload;
      const { data } = await updateAlertSettings(patch, sync);
      upsertFromServer(data);
      resolveMutation(mutation.id);
    } catch (e) {
      const error = e as AppError;
      if (error.isNetworkError || error.isTimeout) return;
      failMutation(mutation.id, error.message);
      throw error;
    }
  }
};

export const runAlertSettingsSync = async () => {
  try {
    await pushPending();
  } catch (e) {
    const error = e as AppError;
    if (error.isNetworkError || error.isTimeout) return;
    throw error;
  }

  try {
    await pullAlertSettings();
  } catch {
    // best-effort reconciliation after a successful push; a later trigger retries
  }
};
