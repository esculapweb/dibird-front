import { useEffect, useState } from "react";

import {
  isConnected,
  subscribeToConnectionChange,
} from "../services/sync/networkStatus";

// Whether the map tiles can load at all (MapL's offline fallback). Also
// lets a caller hide a way into the map instead of opening onto that
// fallback.
export const useIsOnline = (): boolean => {
  const [online, setOnline] = useState(isConnected());

  useEffect(() => subscribeToConnectionChange(setOnline), []);

  return online;
};
