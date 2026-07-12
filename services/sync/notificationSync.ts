import api from "../api";
import { queryClient } from "../queryClient";
import { AppError } from "../../types";
import * as notificationRepository from "../../hooks/repositories/notificationRepository";
import { NotificationMutationPayload } from "../../hooks/repositories/notificationRepository";
import { isConnected } from "./networkStatus";

const NOTIFICATIONS_READ_URL = "/myapi/notifications/read/";

// Mirrors the ["notifications", "unread-count"] key in hooks/useUnreadCount.ts
// — inlined rather than imported to avoid a require cycle back through
// fetches.ts (same reasoning as diarySync.ts inlining ["Diaries"]).
const UNREAD_COUNT_KEY = ["notifications", "unread-count"];

const invalidateNotificationQueries = () => {
  // refetchType "all": this runs in the background regardless of which screen
  // is mounted, same reasoning as diarySync.ts's invalidateDiaryQueries.
  queryClient.invalidateQueries({
    queryKey: ["notifications"],
    exact: false,
    refetchType: "all",
  });
  queryClient.invalidateQueries({
    queryKey: UNREAD_COUNT_KEY,
    exact: false,
    refetchType: "all",
  });
};

// Mirrors diarySync.ts's runDiarySync — see its comments for the reasoning
// behind the inFlight dedupe and the backoff.
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
    runNotificationSync();
  }, retryDelayMs);
  retryDelayMs = Math.min(retryDelayMs * 2, RETRY_MAX_MS);
};

export const stopNotificationSyncRetries = () => {
  clearScheduledRetry();
  retryDelayMs = RETRY_BASE_MS;
};

export const runNotificationSync = (): Promise<void> => {
  clearScheduledRetry();
  if (inFlight) return inFlight;
  inFlight = runNotificationSyncInternal().finally(() => {
    inFlight = null;
  });
  return inFlight;
};

const runNotificationSyncInternal = async () => {
  if (!isConnected()) return;

  for (;;) {
    const mutation = notificationRepository.claimNextMutation();
    if (!mutation) break;

    const payload = mutation.payload as NotificationMutationPayload;

    try {
      const body = payload.op === "markAll" ? { all: true } : { ids: payload.ids };
      await api.post(NOTIFICATIONS_READ_URL, body);
      retryDelayMs = RETRY_BASE_MS;
    } catch (e) {
      const error = e as AppError;
      if (error.isNetworkError || error.isTimeout) {
        notificationRepository.requeuePendingMutation(payload, mutation.createdAt, mutation.attempts);
        scheduleRetry();
        invalidateNotificationQueries();
        return;
      }
      // Non-network error (e.g. a stale/removed id): nothing productive to
      // retry — the local overlay already shows it as read, so drop it
      // rather than keeping a mutation queue around with no error UI to
      // surface it against (unlike diary/observation/place).
      retryDelayMs = RETRY_BASE_MS;
    }
  }

  invalidateNotificationQueries();
  retryDelayMs = RETRY_BASE_MS;
};
