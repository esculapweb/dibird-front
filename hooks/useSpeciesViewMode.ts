import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { loadViewMode, saveViewMode } from "../util/storageHelper";
import { ViewSwitchOption } from "../components/ui/ViewSwitch";

export type SpeciesLayout = "list" | "photos";

// One preference for every species list, not one per screen: someone who
// browses birds as a gallery wants the gallery on the next list they open too.
const LAYOUT_KEY = "SpeciesLayout";
const CAPTIONS_KEY = "SpeciesCaptions";

/**
 * Rows or a photo grid for a list of species, plus whether the grid's tiles
 * carry the species name (the website's "Species names" switch).
 *
 * `ready` works as in useMapViewMode: screens whose layouts load different
 * data (a tree vs the flat list behind the grid) wait for it, so the stored
 * choice doesn't arrive a frame after a wasted fetch.
 */
export const useSpeciesViewMode = () => {
  const { t } = useTranslation();
  const [layout, setLayout] = useState<SpeciesLayout>("list");
  const [showCaptions, setShowCaptions] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([loadViewMode(LAYOUT_KEY), loadViewMode(CAPTIONS_KEY)]).then(
      ([storedLayout, storedCaptions]) => {
        if (!active) return;
        if (storedLayout === "photos") setLayout("photos");
        if (storedCaptions === "hidden") setShowCaptions(false);
        setReady(true);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const changeLayout = useCallback((next: SpeciesLayout) => {
    setLayout(next);
    saveViewMode(LAYOUT_KEY, next);
  }, []);

  const toggleCaptions = useCallback(() => {
    const next = !showCaptions;
    setShowCaptions(next);
    saveViewMode(CAPTIONS_KEY, next ? "shown" : "hidden");
  }, [showCaptions]);

  const photosOption: ViewSwitchOption<"photos"> = {
    value: "photos",
    label: t("view_photos"),
    icon: "images-outline",
  };

  const options: ViewSwitchOption<SpeciesLayout>[] = [
    { value: "list", label: t("view_list"), icon: "list-outline" },
    photosOption,
  ];

  return {
    layout,
    isPhotos: layout === "photos",
    ready,
    changeLayout,
    showCaptions,
    toggleCaptions,
    options,
    photosOption,
  };
};
