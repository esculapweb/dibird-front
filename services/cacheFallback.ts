import * as Sentry from "@sentry/react-native";

import { AppError } from "../types";
import { isConnected } from "./sync/networkStatus";

// Every fetcher in util/fetches.ts is built to the pattern "try — a live
// request, catch — return the cache", and that catch catches absolutely
// everything: a dropped connection, a 500 and a 404. For the user this is the
// right offline-first design, but for us it also masks server regressions: while
// part of the users still have a cache, a breakage looks "intermittent". Here we
// separate the regular offline case (there is nothing to report to Sentry about
// it) from the cases where the cache replaced a real server response.

export type FallbackReason =
  // There is no network — the cache works exactly as intended.
  | "offline"
  // There is a network, but no HTTP response happened: a timeout, DNS, a server that went down.
  | "unreachable"
  // The server answered with a 5xx.
  | "server"
  // The server answered with a 4xx (except "the entity is gone", see assertNotGone).
  | "client";

export const classifyFallback = (e: unknown): FallbackReason => {
  const status = (e as AppError | undefined)?.status;

  // status is only set when there was an HTTP response: for a no-response
  // normalizeApiError returns TIMEOUT/NETWORK_ERROR without it (see
  // services/errors.ts). In RN a dropped connection almost always arrives as
  // TIMEOUT, so isNetworkError cannot be relied upon.
  if (status === undefined || status === 0) {
    return isConnected() ? "unreachable" : "offline";
  }

  return status >= 500 ? "server" : "client";
};

/**
 * Marks in Sentry that an error was hidden by the cache and returns the data as
 * is. Stays silent only on a regular offline — otherwise every launch without a
 * network would flood Sentry with dozens of events in which the real 5xx drown.
 */
export const serveFromCache = <T>(value: T, e: unknown, source: string): T => {
  const reason = classifyFallback(e);
  if (reason === "offline") return value;

  const status = (e as AppError | undefined)?.status;

  Sentry.captureMessage(
    `Cache fallback masked ${status ?? "no response"} in ${source}`,
    {
      level: "warning",
      tags: {
        degraded_read: "true",
        source,
        fallback_reason: reason,
        http_status: String(status ?? 0),
      },
    },
  );

  return value;
};

/**
 * The common shape of all reading fetchers: a live request, and the cache on an
 * error. Plus the branch "there is no network and the response is already stored
 * locally" — then no request is sent at all.
 *
 * The branch is needed because an offline request does NOT fail immediately: the
 * socket hangs until the `timeout: 10000` from services/api.ts (measured on an
 * Android emulator in airplane mode — the request failed after 10.1 s, after
 * which reading the cache took 11 ms). All that time the screen sits on a
 * spinner, even though there is already something to show.
 *
 * Only when there is data: if the cache is empty the request goes to the network
 * as usual. isConnected() relies on NetInfo, and that one can be wrong (the
 * reachability probe did not pass even though our API is available) — losing 10 s
 * on a timeout is cheaper than showing an error where the data really could have
 * been fetched.
 *
 * @param readCache must return null when there is nothing to show (an empty
 *   array is "nothing", not "an empty server response")
 * @param onRequestError a hook for assertNotGone: runs before the cache is read,
 *   so that a 404/410 flies outwards instead of being replaced by the cache
 */
export const cachedRead = async <T>(
  source: string,
  readCache: () => T | null,
  request: () => Promise<T>,
  onRequestError?: (e: unknown) => void,
): Promise<T> => {
  if (!isConnected()) {
    const offline = readCache();
    // e === undefined: it never got as far as the request, there is no error.
    // classifyFallback without a status and without a network gives "offline",
    // that is, nothing flies to Sentry, just as with a caught offline error.
    if (offline !== null) return serveFromCache(offline, undefined, source);
  }

  try {
    return await request();
  } catch (e) {
    onRequestError?.(e);
    const cached = readCache();
    if (cached !== null) return serveFromCache(cached, e, source);
    throw e;
  }
};

/**
 * Rethrows a 404/410 instead of returning the cache: the entity is gone from the
 * server, and the cache would keep showing it forever.
 *
 * Call ONLY where a negative temp id of a locally created entity
 * (Place/Observation/Diary) cannot arrive — for those a 404 from the server is
 * regular, and the fallback to the repository is the only way to open the record.
 */
export const assertNotGone = (e: unknown): void => {
  const status = (e as AppError | undefined)?.status;
  if (status === 404 || status === 410) throw e;
};
