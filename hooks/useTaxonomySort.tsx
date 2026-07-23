import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import SortSheetContent from "../components/Sort/SortSheetContent";
import { BottomSheet } from "../services/bottomSheet";
import { useSavedSort } from "./useSavedSort";
import { sortOptionsList } from "../util/sortOptionsList";

const SCREEN = "Taxonomy";

// Shared by every taxonomy list screen so the chosen order (alphabetical or
// scientific) carries across orders → families → genera → species.
//
// `pinnedSort` lets a shared deep link open the list in a specific order
// without touching the saved preference. It's an override, not a seed: the
// first time the user picks a sort themselves it's dropped, so the control
// keeps working (otherwise the pinned route param would mask every change).
export const useTaxonomySort = (pinnedSort?: string) => {
  const { t } = useTranslation();
  const { sort: savedSort, onChange } = useSavedSort(SCREEN);
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
          screen={SCREEN}
          options={sortOptionsList(SCREEN)}
          sort={sort}
          setSort={(value) => setSort(value as string)}
          dismiss={dismiss}
        />
      ),
    });
  }, [t, sort, setSort]);

  return { sort, openSortSheet };
};
