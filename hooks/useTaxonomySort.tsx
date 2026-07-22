import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import SortSheetContent from "../components/Sort/SortSheetContent";
import { BottomSheet } from "../services/bottomSheet";
import { useSavedSort } from "./useSavedSort";
import { sortOptionsList } from "../util/sortOptionsList";

const SCREEN = "Taxonomy";

// Shared by every taxonomy list screen so the chosen order (alphabetical or
// scientific) carries across orders → families → genera → species.
export const useTaxonomySort = () => {
  const { t } = useTranslation();
  const { sort, onChange } = useSavedSort(SCREEN);

  const openSortSheet = useCallback(() => {
    BottomSheet.showContent({
      title: t("sort_by"),
      renderContent: (dismiss: () => void) => (
        <SortSheetContent
          screen={SCREEN}
          options={sortOptionsList(SCREEN)}
          sort={sort}
          setSort={(value) => onChange(value as string)}
          dismiss={dismiss}
        />
      ),
    });
  }, [t, sort, onChange]);

  return { sort, openSortSheet };
};
