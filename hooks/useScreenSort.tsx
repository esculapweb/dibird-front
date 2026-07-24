import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import SortSheetContent from "../components/Sort/SortSheetContent";
import { BottomSheet } from "../services/bottomSheet";
import { useSavedSort } from "./useSavedSort";
import { sortOptionsList } from "../util/sortOptionsList";

// A saved sort preference plus the sheet that changes it, shared by every
// screen of one catalogue section (see useTaxonomySort for the taxonomy one)
// so the chosen order carries across its screens.
//
// `pinnedSort` lets a shared deep link open the list in a specific order
// without touching the saved preference. It's an override, not a seed: the
// first time the user picks a sort themselves it's dropped, so the control
// keeps working (otherwise the pinned route param would mask every change).
export const useScreenSort = (screen: string, pinnedSort?: string) => {
  const { t } = useTranslation();
  const { sort: savedSort, onChange } = useSavedSort(screen);
  const [override, setOverride] = useState<string | null>(pinnedSort ?? null);

  const sort = override ?? savedSort;

  const setSort = useCallback(
    (value: string) => {
      setOverride(null);
      onChange(value);
    },
    [onChange],
  );

  const openSortSheet = useCallback(() => {
    BottomSheet.showContent({
      title: t("sort_by"),
      renderContent: (dismiss: () => void) => (
        <SortSheetContent
          screen={screen}
          options={sortOptionsList(screen)}
          sort={sort}
          setSort={(value) => setSort(value as string)}
          dismiss={dismiss}
        />
      ),
    });
  }, [t, screen, sort, setSort]);

  return { sort, openSortSheet };
};
