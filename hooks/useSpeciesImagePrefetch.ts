import { useEffect, useRef } from "react";

import { registerOnProfileSaved } from "../store/profile-context";
import { subscribeToReconnect } from "../services/sync/networkStatus";
import {
  runSpeciesImagePrefetch,
  stopSpeciesImagePrefetchRetries,
} from "../services/sync/speciesImagePrefetch";

// Warms the species-thumbnail disk cache once the user's territory is known
// (login, or a later territory change) and again on reconnect if that first
// attempt found no connection. Mirrors the registerOnProfileSaved trigger
// used by store/filters-context.tsx, not the AppState-foreground wiring the
// mutation-queue sync hooks use — there's no queue to keep draining here,
// runSpeciesImagePrefetch just no-ops once a territory is already cached.
export const useSpeciesImagePrefetch = (isAuthenticated: boolean) => {
  const territoryRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      territoryRef.current = null;
      stopSpeciesImagePrefetchRetries();
      return;
    }

    const unsubscribeProfile = registerOnProfileSaved((territory) => {
      territoryRef.current = territory;
      runSpeciesImagePrefetch(territory);
    });

    const unsubscribeReconnect = subscribeToReconnect(() => {
      if (territoryRef.current != null) runSpeciesImagePrefetch(territoryRef.current);
    });

    return () => {
      unsubscribeProfile();
      unsubscribeReconnect();
      stopSpeciesImagePrefetchRetries();
    };
  }, [isAuthenticated]);
};
