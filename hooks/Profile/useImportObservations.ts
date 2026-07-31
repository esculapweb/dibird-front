import { useState, useRef, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  startObservationImport,
  pollObservationImportStatus,
} from "../../util/fetches";
import { clearAllListCaches } from "../repositories/listCacheRepository";
import { INVALIDATION_MAP } from "../../util/invalidationMap";
import { track } from "../../services/analytics";
import { ObservationImport, ObservationImportStatus, AppError } from "../../types";

const POLL_INTERVAL_MS = 5000;

/**
 * Importing an eBird export. The structure is the same as in
 * [useExportProfile](../Profile/useExportProfile.ts): the request starts a task
 * on the backend and returns 202, after which `status/` is polled until a
 * terminal state.
 *
 * There is one difference, but an essential one: on completion the local mirror
 * has to be reset, not just a report shown. The records were created on the
 * server bypassing the sync queue, and the SQLite cache of the lists knows
 * nothing about them — without a reset the life list and the statistics would
 * stay pre-import until the cache expires.
 */
export const useImportObservations = () => {
  const [state, setState] = useState<ObservationImportStatus>("idle");
  const [result, setResult] = useState<ObservationImport | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queryClient = useQueryClient();

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const refreshAfterImport = useCallback(() => {
    // Disk first, react-query second: invalidation starts refetches right away,
    // and those must write fresh responses into an already empty cache, not into
    // the one we are about to clear.
    clearAllListCaches();

    for (const key of INVALIDATION_MAP.Observation.add) {
      // refetchType: "all" for the same reason as in observationSync: the screens
      // the import was not started from are unmounted, and `useList` does not
      // refetch on mount — otherwise they would open pre-import.
      queryClient.invalidateQueries({ queryKey: key, refetchType: "all" });
    }
  }, [queryClient]);

  const startPolling = useCallback(() => {
    const check = async () => {
      try {
        const data = await pollObservationImportStatus();
        setState(data.status);
        setResult(data);

        if (data.status === "completed") {
          stopPolling();
          refreshAfterImport();
          track("import_finished", {
            imported: data.imported,
            unmatched: data.unmatched.length,
          });
        } else if (data.status === "failed") {
          stopPolling();
        }
      } catch {
        stopPolling();
        setState("failed");
      }
    };

    check();
    intervalRef.current = setInterval(check, POLL_INTERVAL_MS);
  }, [stopPolling, refreshAfterImport]);

  const startImport = useCallback(
    async (file: { uri: string; name: string }, makePublic: boolean) => {
      try {
        setState("pending");
        setResult(null);
        track("import_started");
        await startObservationImport(file, makePublic);
        startPolling();
      } catch (e) {
        const error = e as AppError;
        // 429 — an import is already running (the screen was reopened after
        // being backgrounded, for example). Attach to it instead of reporting an
        // error.
        if (error?.response?.status === 429) {
          startPolling();
        } else {
          setState("failed");
        }
      }
    },
    [startPolling],
  );

  const reset = useCallback(() => {
    stopPolling();
    setState("idle");
    setResult(null);
  }, [stopPolling]);

  useEffect(() => stopPolling, [stopPolling]);

  return { state, result, startImport, reset };
};
