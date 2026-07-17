import api from "../api";
import { queryClient } from "../queryClient";
import { AppError } from "../../types";
import * as diaryRepository from "../../hooks/repositories/diaryRepository";
import { DiaryMutationPayload } from "../../hooks/repositories/diaryRepository";
import * as placeRepository from "../../hooks/repositories/placeRepository";
import { isConnected } from "./networkStatus";
import { runObservationSync } from "./observationSync";
import { INVALIDATION_MAP } from "../../util/invalidationMap";

const DIARY_URL = "/myapi/diary2/";

const invalidateDiaryQueries = (...ids: (number | null | undefined)[]) => {
  // Same reasoning as observationSync.ts's invalidateObservationQueries:
  // refetchType "all" because this runs in the background regardless of which
  // screen is mounted, and useList's infinite query has refetchOnMount disabled.
  //
  // Uses the same key list as the live (online) update path (useOfflineDiary's
  // invalidateDiaryCaches) — a diary's PATCH cascades private/location_private/
  // date_time/place to every observation in it server-side (see the backend's
  // DiaryBaseSerializer.update), so this must also invalidate the Observation
  // caches, not just the diary's own. Missing that left an offline-edited
  // diary's observations showing stale (pre-cascade) data forever after sync.
  INVALIDATION_MAP.Diary.update.forEach((key) =>
    queryClient.invalidateQueries({ queryKey: key, exact: false, refetchType: "all" }),
  );
  // Takes every id to invalidate in one call (rather than being called once
  // per id) so the loop above — and the network refetches it triggers —
  // only runs once per sync event instead of once per id.
  ids.forEach((id) => {
    if (id == null) return;
    queryClient.invalidateQueries({
      queryKey: ["Diary", id],
      exact: false,
      refetchType: "all",
    });
  });
};

// Mirrors observationSync.ts's runObservationSync one-for-one — see its
// comments for the reasoning behind the inFlight dedupe and the backoff.
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
    runDiarySync();
  }, retryDelayMs);
  retryDelayMs = Math.min(retryDelayMs * 2, RETRY_MAX_MS);
};

export const stopDiarySyncRetries = () => {
  clearScheduledRetry();
  retryDelayMs = RETRY_BASE_MS;
};

export const runDiarySync = (): Promise<void> => {
  clearScheduledRetry();
  if (inFlight) return inFlight;
  inFlight = runDiarySyncInternal().finally(() => {
    inFlight = null;
  });
  return inFlight;
};

const runDiarySyncInternal = async () => {
  if (!isConnected()) return;

  // See observationSync.ts's equivalent `deferred` array for the full
  // reasoning: holding a not-yet-ready mutation here instead of stopping the
  // whole pass lets other, independent diary mutations in the same batch
  // still go through this pass instead of being blocked behind it.
  const deferred: { payload: DiaryMutationPayload; createdAt: number; attempts: number }[] = [];

  for (;;) {
    const mutation = diaryRepository.claimNextMutation();
    if (!mutation) break;

    const payload = mutation.payload as DiaryMutationPayload;

    // A diary queued against a place created offline in the same session
    // still carries that place's temp negative id in payload.data.place —
    // resolve it fresh right before sending. See placeRepository.resolvePlaceId
    // and observationSync.ts's equivalent block.
    if (payload.op === "create" || payload.op === "update") {
      const placeId = payload.data.place;
      if (placeId != null && placeId < 0) {
        const resolved = placeRepository.resolvePlaceId(placeId);
        if (resolved == null) {
          retryDelayMs = RETRY_BASE_MS;
          diaryRepository.requeueFailedMutation(
            payload,
            mutation.createdAt,
            mutation.attempts,
            payload.localId,
            "Parent place could not be synced",
          );
          invalidateDiaryQueries(payload.localId);
          continue;
        }
        if (resolved < 0) {
          deferred.push({ payload, createdAt: mutation.createdAt, attempts: mutation.attempts });
          continue;
        }
        payload.data = { ...payload.data, place: resolved };
      }
    }

    try {
      if (payload.op === "create") {
        const res = await api.post(DIARY_URL, {
          ...payload.data,
          client_request_id: payload.clientRequestId,
        });
        diaryRepository.replaceLocalWithServer(payload.localId, res.data);
        invalidateDiaryQueries(payload.localId, res.data.id);
        // Any observation queued against this diary's temp id while it was
        // still pending (see observationSync.ts's `resolved < 0` backoff) can
        // now resolve it — wake that queue immediately instead of leaving it
        // to its own retry timer.
        runObservationSync();
      } else if (payload.op === "update") {
        const res = await api.patch(`${DIARY_URL}${payload.localId}/`, payload.data);
        diaryRepository.upsertFromServer(res.data);
        invalidateDiaryQueries(payload.localId);
      } else {
        await api.delete(`${DIARY_URL}${payload.localId}/`);
        diaryRepository.removeLocal(payload.localId);
        invalidateDiaryQueries(payload.localId);
      }
      retryDelayMs = RETRY_BASE_MS;
    } catch (e) {
      const error = e as AppError;
      if (error.isNetworkError || error.isTimeout) {
        diaryRepository.requeuePendingMutation(payload, mutation.createdAt, mutation.attempts);
        deferred.forEach((d) =>
          diaryRepository.requeuePendingMutation(d.payload, d.createdAt, d.attempts),
        );
        scheduleRetry();
        return;
      }
      retryDelayMs = RETRY_BASE_MS;
      diaryRepository.requeueFailedMutation(
        payload,
        mutation.createdAt,
        mutation.attempts,
        payload.localId,
        error.message,
      );
      invalidateDiaryQueries(payload.localId);
    }
  }

  if (deferred.length > 0) {
    deferred.forEach((d) =>
      diaryRepository.requeuePendingMutation(d.payload, d.createdAt, d.attempts),
    );
    scheduleRetry();
  } else {
    retryDelayMs = RETRY_BASE_MS;
  }
};
