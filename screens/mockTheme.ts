// Shared useTheme() mock factory — same Colors shape duplicated across
// components/Profile/__tests__/FailedEditBanner.test.tsx and
// components/ui/__tests__/StatCard.test.tsx, lifted here so screens/__tests__
// files don't reinvent it a third/fourth time. Extend the returned object
// with whatever additional Colors keys a given screen reads.
export const mockColors = {
  main100: "#1a73e8",
  error100: "#fee",
  error600: "#900",
  textMain: "#000",
  textMiddle: "#666",
  // The two sides of a comparison, plus the "neither" fill — a blank dot has
  // to be distinguishable from a filled one for the compare rows' tests.
  compareP1: "#2d6a4f",
  compareP2: "#9d4edd",
  imageBg: "#eee",
};

export const mockUseTheme = () => ({ Colors: mockColors });
