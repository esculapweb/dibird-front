import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import { runPlaceSync, stopPlaceSyncRetries } from "../../services/sync/placeSync";
import { subscribeToReconnect } from "../../services/sync/networkStatus";

// Verbatim mirror of hooks/Diary/useDiarySync.ts — drains the place mutation
// queue regardless of which screen is mounted.
export const usePlaceSync = (isAuthenticated: boolean) => {
  const lastRunRef = useRef<number>(0);

  useEffect(() => {
    if (!isAuthenticated) {
      stopPlaceSyncRetries();
      return;
    }

    const trigger = () => {
      lastRunRef.current = Date.now();
      runPlaceSync();
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
      stopPlaceSyncRetries();
    };
  }, [isAuthenticated]);
};
