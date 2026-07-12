import api from "../api";
import { queryClient } from "../queryClient";
import { AppError } from "../../types";
import * as placeRepository from "../../hooks/repositories/placeRepository";
import { PlaceMutationPayload } from "../../hooks/repositories/placeRepository";
import { isConnected } from "./networkStatus";
import { runObservationSync } from "./observationSync";
import { runDiarySync } from "./diarySync";
import { INVALIDATION_MAP } from "../../util/invalidationMap";

const PLACE_URL = "/myapi/place2/";

const invalidatePlaceQueries = (id?: number | null) => {
  // refetchType "all" (not the default "active") matters here: this sync
  // runs in the background regardless of which screen is mounted, and
  // useList's infinite query has refetchOnMount disabled — so a query that's
  // merely marked stale while unmounted would otherwise keep showing
  // whatever it last had the next time it's opened.
  //
  // Uses the same key list as the live (online) create/update path (see
  // useOfflinePlace.ts's invalidatePlaceCaches) — a place's counts/name feed
  // into Observation/Diary cards' denormalized place_data snapshot and
  // DashboardStat, same reasoning as observationSync.ts's equivalent.
  INVALIDATION_MAP.Place.update.forEach((key) =>
    queryClient.invalidateQueries({ queryKey: key, exact: false, refetchType: "all" }),
  );
  if (id != null) {
    queryClient.invalidateQueries({
      queryKey: ["Place", id],
      exact: false,
      refetchType: "all",
    });
  }
};

// Mirrors diarySync.ts's runDiarySync one-for-one — see its comments for the
// reasoning behind the inFlight dedupe and the backoff.
let inFlight: Promise<void> | null = null;

const RETRY_BASE_MS = 4000;
const RETRY_MAX_MS = 60000;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelayMs = RETRY_BASE_MS;

const clearScheduledRetry = () => {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
};

const scheduleRetry = () => {
  clearScheduledRetry();
  retryTimer = setTimeout(() => {
    retryTimer = null;
    runPlaceSync();
  }, retryDelayMs);
  retryDelayMs = Math.min(retryDelayMs * 2, RETRY_MAX_MS);
};

export const stopPlaceSyncRetries = () => {
  clearScheduledRetry();
  retryDelayMs = RETRY_BASE_MS;
};

export const runPlaceSync = (): Promise<void> => {
  clearScheduledRetry();
  if (inFlight) return inFlight;
  inFlight = runPlaceSyncInternal().finally(() => {
    inFlight = null;
  });
  return inFlight;
};

const runPlaceSyncInternal = async () => {
  if (!isConnected()) return;

  for (;;) {
    const mutation = placeRepository.claimNextMutation();
    if (!mutation) {
      retryDelayMs = RETRY_BASE_MS;
      return;
    }

    const payload = mutation.payload as PlaceMutationPayload;

    try {
      if (payload.op === "create") {
        const res = await api.post(PLACE_URL, {
          ...payload.data,
          client_request_id: payload.clientRequestId,
        });
        placeRepository.replaceLocalWithServer(payload.localId, res.data);
        invalidatePlaceQueries(payload.localId);
        invalidatePlaceQueries(res.data.id);
        // Any observation/diary queued against this place's temp id while it
        // was still pending can now resolve it — wake both queues
        // immediately instead of leaving them to their own retry timers.
        runObservationSync();
        runDiarySync();
      } else if (payload.op === "update") {
        const res = await api.patch(`${PLACE_URL}${payload.localId}/`, payload.data);
        placeRepository.upsertFromServer(res.data);
        invalidatePlaceQueries(payload.localId);
      } else {
        await api.delete(`${PLACE_URL}${payload.localId}/`);
        placeRepository.removeLocal(payload.localId);
        invalidatePlaceQueries(payload.localId);
      }
      retryDelayMs = RETRY_BASE_MS;
    } catch (e) {
      const error = e as AppError;
      if (error.isNetworkError || error.isTimeout) {
        placeRepository.requeuePendingMutation(payload, mutation.createdAt, mutation.attempts);
        scheduleRetry();
        return;
      }
      retryDelayMs = RETRY_BASE_MS;
      placeRepository.requeueFailedMutation(
        payload,
        mutation.createdAt,
        mutation.attempts,
        payload.localId,
        error.message,
      );
      invalidatePlaceQueries(payload.localId);
    }
  }
};
