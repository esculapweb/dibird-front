import api from "../api";
import { queryClient } from "../queryClient";
import { AppError } from "../../types";
import * as observationRepository from "../../hooks/repositories/observationRepository";
import { ObservationMutationPayload } from "../../hooks/repositories/observationRepository";
import { isConnected } from "./networkStatus";

const OBSERVATION_URL = "/myapi/observation2/";

const invalidateObservationQueries = (id?: number | null) => {
  // refetchType: "all" (not the default "active") matters here: this sync runs
  // in the background on reconnect regardless of which screen is mounted, and
  // useList's infinite query has refetchOnMount disabled — so a query that's
  // merely marked stale while unmounted would otherwise keep showing whatever
  // (possibly wrong/incomplete) data it last had the next time it's opened.
  queryClient.invalidateQueries({
    queryKey: ["Observations"],
    exact: false,
    refetchType: "all",
  });
  if (id != null) {
    queryClient.invalidateQueries({
      queryKey: ["Observation", id],
      exact: false,
      refetchType: "all",
    });
  }
};

// Drains the local mutation queue for entity "observation". Unlike profileSync
// (a singleton row), several independent offline-created/edited/deleted
// observations can be queued at once, so a real (non-network) error on one
// mutation only fails that mutation and moves on to the next — it must not
// block the rest of the batch.
//
// This is triggered from several independent places (the reconnect listener,
// app-foreground, and a focus-effect retry on both Observation screens), so
// overlapping calls are expected — e.g. reconnecting while the list screen is
// focused fires more than one of these near-simultaneously. Without a lock,
// each overlapping call would read the same still-pending "create" mutation
// before the first one resolves it and POST it again, creating duplicates on
// the server. inFlight makes every concurrent caller await the one run
// already in progress instead of starting a second pass over the same queue.
let inFlight: Promise<void> | null = null;

// Self-rescheduling backoff for the case NetInfo can't see: a radio that's
// "connected" the whole time (2G, poor 3G, saturated wifi) but where the
// request itself keeps timing out. That case never fires subscribeToReconnect
// (there's no disconnected->connected edge to detect) and may never get
// another screen focus or app-foreground event either, so without this a
// pending create could sit in the queue for the rest of the session. Doubles
// on each consecutive timeout/network failure, resets to the base delay as
// soon as one attempt gets an actual response (success or a real error) or
// the queue fully drains, and stays close to the flicker case's plain retry
// speed instead of assuming a request that timed out means it's hopeless.
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
    runObservationSync();
  }, retryDelayMs);
  retryDelayMs = Math.min(retryDelayMs * 2, RETRY_MAX_MS);
};

// Cancels any pending backoff retry and resets it back to the base delay —
// call on logout so a stale queue for a signed-out session doesn't keep
// waking up and retrying in the background.
export const stopObservationSyncRetries = () => {
  clearScheduledRetry();
  retryDelayMs = RETRY_BASE_MS;
};

export const runObservationSync = (): Promise<void> => {
  clearScheduledRetry();
  if (inFlight) return inFlight;
  inFlight = runObservationSyncInternal().finally(() => {
    inFlight = null;
  });
  return inFlight;
};

const runObservationSyncInternal = async () => {
  if (!isConnected()) return;

  // Claims (atomically removes) one mutation at a time rather than reading
  // the whole pending list upfront — any mutation not yet claimed stays
  // untouched in the queue, so a failure partway through only needs to put
  // *that* mutation back, not everything after it.
  for (;;) {
    const mutation = observationRepository.claimNextMutation();
    if (!mutation) {
      retryDelayMs = RETRY_BASE_MS;
      return;
    }

    const payload = mutation.payload as ObservationMutationPayload;

    try {
      if (payload.op === "create") {
        // Same client_request_id as the original live attempt (see
        // useCreateObservation) — lets a backend that recognizes a repeat
        // return the already-created row instead of making another one.
        const res = await api.post(OBSERVATION_URL, {
          ...payload.data,
          client_request_id: payload.clientRequestId,
        });
        observationRepository.replaceLocalWithServer(payload.localId, res.data);
        invalidateObservationQueries(payload.localId);
        invalidateObservationQueries(res.data.id);
      } else if (payload.op === "update") {
        const res = await api.patch(`${OBSERVATION_URL}${payload.localId}/`, payload.data);
        observationRepository.upsertFromServer(res.data);
        invalidateObservationQueries(payload.localId);
      } else {
        await api.delete(`${OBSERVATION_URL}${payload.localId}/`);
        observationRepository.removeLocal(payload.localId);
        invalidateObservationQueries(payload.localId);
      }
      // Got a real response (this attempt's own success) — the link is
      // working right now, so drop back to the base retry delay for
      // whatever's still ahead in the queue instead of staying backed off
      // from earlier failures.
      retryDelayMs = RETRY_BASE_MS;
    } catch (e) {
      const error = e as AppError;
      if (error.isNetworkError || error.isTimeout) {
        observationRepository.requeuePendingMutation(payload, mutation.createdAt, mutation.attempts);
        scheduleRetry();
        return;
      }
      // A real (non-network) error is still a response from the server, so
      // the same reasoning applies — reset the backoff before moving on to
      // the next queued mutation.
      retryDelayMs = RETRY_BASE_MS;
      observationRepository.requeueFailedMutation(
        payload,
        mutation.createdAt,
        mutation.attempts,
        payload.localId,
        error.message,
      );
      invalidateObservationQueries(payload.localId);
    }
  }
};
