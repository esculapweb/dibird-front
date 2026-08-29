import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import { runObservationSync, stopObservationSyncRetries } from "../../services/sync/observationSync";
import {
  runObservationPhotoSync,
  stopObservationPhotoSyncRetries,
} from "../../services/sync/observationPhotoSync";
import { subscribeToReconnect } from "../../services/sync/networkStatus";

// Drains the observation mutation queue regardless of which screen is mounted
// (mirrors the reconnect/app-foreground wiring in store/profile-context.tsx),
// so observations created/edited/deleted offline sync even if the user has
// since navigated away from the Observations screens.
export const useObservationSync = (isAuthenticated: boolean) => {
  const lastRunRef = useRef<number>(0);

  useEffect(() => {
    if (!isAuthenticated) {
      stopObservationSyncRetries();
      stopObservationPhotoSyncRetries();
      return;
    }

    const trigger = () => {
      lastRunRef.current = Date.now();
      runObservationSync();
      // Photos of observations that synced in an earlier session are queued
      // independently, so they need their own trigger — observationSync only
      // wakes this queue when it creates an observation right now.
      runObservationPhotoSync();
    };

    trigger();

    const unsubscribeReconnect = subscribeToReconnect(trigger);

    let timeout: ReturnType<typeof setTimeout> | null = null;
    let prevState = AppState.currentState;

    const sub = AppState.addEventListener("change", (state) => {
      const wasBackground = prevState === "background" || prevState === "inactive";
      prevState = state;

      if (state === "active" && wasBackground) {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
          const secsSinceRun = (Date.now() - lastRunRef.current) / 1000;
          if (secsSinceRun > 10) trigger();
        }, 500);
      }
    });

    return () => {
      unsubscribeReconnect();
      sub.remove();
      if (timeout) clearTimeout(timeout);
      stopObservationSyncRetries();
      stopObservationPhotoSyncRetries();
    };
  }, [isAuthenticated]);
};
