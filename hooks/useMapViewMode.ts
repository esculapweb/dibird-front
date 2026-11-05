import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { loadViewMode, saveViewMode } from "../util/storageHelper";
import { ViewSwitchOption } from "../components/ui/ViewSwitch";
import { track } from "../services/analytics";

export type MapViewMode = "list" | "map";

/**
 * List/map toggle for a ListScreen-based screen, with the choice remembered
 * per screen the way its sort is.
 *
 * `ready` is what keeps the screen from mounting the list, then swapping it for
 * the map a frame later once the stored mode arrives — that flash costs a
 * whole wasted fetch on every open.
 */
export const useMapViewMode = (screenName: string) => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<MapViewMode>("list");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    loadViewMode(screenName).then((stored) => {
      if (!active) return;
      if (stored === "map") setViewMode("map");
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [screenName]);

  const changeViewMode = useCallback(
    (next: MapViewMode) => {
      // Only a switch the user made: a map mode restored from storage on
      // mount goes through setViewMode directly and is not an "open".
      if (next === "map") track("map_opened", { screen: screenName });
      setViewMode(next);
      saveViewMode(screenName, next);
    },
    [screenName],
  );

  const options: ViewSwitchOption<MapViewMode>[] = [
    { value: "list", label: t("view_list"), icon: "list-outline" },
    { value: "map", label: t("view_map"), icon: "map-outline" },
  ];

  return { viewMode, ready, changeViewMode, options };
};
