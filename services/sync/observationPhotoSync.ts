import { AppError, ObservationPhoto } from "../../types";
import { uploadObservationPhoto, deleteObservationPhoto } from "../../util/fetches";
import * as observationRepository from "../../hooks/repositories/observationRepository";
import * as observationPhotoRepository from "../../hooks/repositories/observationPhotoRepository";
import { ObservationPhotoMutationPayload } from "../../hooks/repositories/observationPhotoRepository";
import { deleteLocalPhoto } from "../../util/photoFiles";
import { isConnected } from "./networkStatus";
import { INVALIDATION_MAP } from "../../util/invalidationMap";
import { beginSyncPass, endSyncPass, queueInvalidation } from "./syncBatch";

const invalidatePhotoQueries = (...ids: (number | null | undefined)[]) => {
  queueInvalidation([
    ...INVALIDATION_MAP.Observation.update,
    ...ids.filter((id) => id != null).map((id) => ["Observation", id]),
  ]);
};

// Drains the local mutation queue for entity "observationPhoto".
//
// A separate queue from observationSync rather than a branch inside it,
// because a photo's lifecycle is independent of its observation's: the
// observation can already be synced while its photos are still uploading, and
// one photo failing must not put the observation itself into the error state
// that raises FailedEditBanner. The dependency runs one way only — a photo
// can be sent only once its observation has a real server id — and that is
// resolved here, exactly the way observationSync resolves its own parent
// diary/place temp ids.
let inFlight: Promise<void> | null = null;

// Same self-rescheduling backoff as observationSync: a radio that stays
// "connected" while every request times out never fires a reconnect event, so
// without this a queued photo could sit there for the rest of the session.
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
    runObservationPhotoSync();
  }, retryDelayMs);
  retryDelayMs = Math.min(retryDelayMs * 2, RETRY_MAX_MS);
};

export const stopObservationPhotoSyncRetries = () => {
  clearScheduledRetry();
  retryDelayMs = RETRY_BASE_MS;
};

export const runObservationPhotoSync = (): Promise<void> => {
  clearScheduledRetry();
  if (inFlight) return inFlight;
  beginSyncPass();
  inFlight = runObservationPhotoSyncInternal().finally(() => {
    inFlight = null;
    endSyncPass();
  });
  return inFlight;
};

const runObservationPhotoSyncInternal = async () => {
  if (!isConnected()) return;

  // Photos whose observation hasn't synced *yet this pass* are held here
  // rather than put straight back on the queue — claimNextMutation always
  // claims the oldest row, so re-queuing would just reclaim the same one
  // forever, while stopping the pass would block every unrelated photo behind
  // it. Same mechanism, and same reasoning, as observationSync's `deferred`.
  const deferred: {
    payload: ObservationPhotoMutationPayload;
    createdAt: number;
    attempts: number;
  }[] = [];

  for (;;) {
    const mutation = observationPhotoRepository.claimNextMutation();
    if (!mutation) break;

    const payload = mutation.payload as ObservationPhotoMutationPayload;
    const row = observationPhotoRepository.getPhotoRow(payload.photoLocalId);

    if (!row) {
      // The photo was removed locally after this mutation was queued (the
      // user deleted it again before it ever left the device).
      continue;
    }

    const observationId = observationRepository.resolveObservationId(
      payload.observationLocalId,
    );

    if (observationId == null) {
      // The observation was discarded, or its own create failed permanently
      // (see resolveObservationId) — this photo can never be attached to
      // anything, so drop it along with its file instead of retrying forever.
      retryDelayMs = RETRY_BASE_MS;
      const orphanedFile = observationPhotoRepository.discardPhoto(payload.photoLocalId);
      deleteLocalPhoto(orphanedFile);
      invalidatePhotoQueries(payload.observationLocalId);
      continue;
    }

    if (observationId < 0) {
      deferred.push({
        payload,
        createdAt: mutation.createdAt,
        attempts: mutation.attempts,
      });
      continue;
    }

    try {
      if (payload.op === "upload") {
        const serverPhoto = await uploadObservationPhoto(
          observationId,
          row.localUri!,
          row.sortOrder,
          row.clientRequestId!,
        );
        const uploadedFile = observationPhotoRepository.resolveUpload(
          payload.photoLocalId,
          [payload.observationLocalId, observationId],
          serverPhoto,
        );
        // The server has its own copy now; the local one is dead weight.
        deleteLocalPhoto(uploadedFile);
      } else {
        await deleteObservationPhoto(row.serverId!);
        observationPhotoRepository.resolveDelete(payload.photoLocalId);
      }
      invalidatePhotoQueries(payload.observationLocalId, observationId);
      retryDelayMs = RETRY_BASE_MS;
    } catch (e) {
      const error = e as AppError;

      if (error.isNetworkError || error.isTimeout) {
        // Connectivity just dropped again — every other request in this pass
        // would fail the same way. Anything already deferred only exists in
        // memory at this point (claimNextMutation deleted its row), so it has
        // to go back too.
        observationPhotoRepository.requeuePendingMutation(
          payload,
          mutation.createdAt,
          mutation.attempts,
        );
        deferred.forEach((d) =>
          observationPhotoRepository.requeuePendingMutation(
            d.payload,
            d.createdAt,
            d.attempts,
          ),
        );
        scheduleRetry();
        return;
      }

      if (payload.op === "delete" && isAlreadyGone(error)) {
        // The photo is not there any more, which is exactly what this
        // mutation wanted. Treating it as an error would leave the row stuck
        // in the queue forever.
        observationPhotoRepository.resolveDelete(payload.photoLocalId);
        invalidatePhotoQueries(payload.observationLocalId, observationId);
        retryDelayMs = RETRY_BASE_MS;
        continue;
      }

      retryDelayMs = RETRY_BASE_MS;

      if (payload.op === "delete") {
        // The photo is still on the server, so put it back into the strip —
        // otherwise it silently disappears from the UI while continuing to
        // exist everywhere else.
        observationPhotoRepository.restorePhoto(payload.observationLocalId, {
          id: row.serverId!,
          image: null,
          thumbnail: null,
          sort_order: row.sortOrder,
          created_at: new Date(row.createdAt).toISOString(),
        } satisfies ObservationPhoto);
      }

      observationPhotoRepository.requeueFailedMutation(
        payload,
        mutation.createdAt,
        mutation.attempts,
        error.message,
      );
      invalidatePhotoQueries(payload.observationLocalId, observationId);
    }
  }

  if (deferred.length > 0) {
    // Everything claimable this pass was attempted; only photos waiting on
    // their observation are left. They are woken directly by observationSync
    // once that create succeeds — this timer is the safety net.
    deferred.forEach((d) =>
      observationPhotoRepository.requeuePendingMutation(
        d.payload,
        d.createdAt,
        d.attempts,
      ),
    );
    scheduleRetry();
  } else {
    retryDelayMs = RETRY_BASE_MS;
  }
};

const isAlreadyGone = (error: AppError) =>
  error.response?.status === 404 || error.response?.status === 410;
