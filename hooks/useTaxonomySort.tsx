import { useScreenSort } from "./useScreenSort";

// Shared by every taxonomy list screen so the chosen order (alphabetical or
// scientific) carries across orders → families → genera → species. The
// pinned-sort behaviour lives in useScreenSort, which the countries catalogue
// uses the same way.
export const useTaxonomySort = (pinnedSort?: string) =>
  useScreenSort("Taxonomy", pinnedSort);
