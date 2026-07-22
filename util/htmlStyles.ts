import { ThemeColors } from "../store/theme-context";

// Shared styling for the two places we render server HTML (species and
// static pages). The content isn't just paragraphs — descriptions carry
// <h2>/<h3> subheadings and <ul>/<li> lists — so `baseStyle` sets the text
// colour for everything, and without it those tags fell back to black and
// vanished on the dark theme.
export const htmlBaseStyle = (Colors: ThemeColors) => ({
  color: Colors.textMiddle,
  fontSize: 14,
  lineHeight: 22,
});

export const htmlTagsStyles = (Colors: ThemeColors) => ({
  h2: {
    color: Colors.textMain,
    fontSize: 18,
    fontWeight: "600" as const,
    marginTop: 24,
  },
  h3: {
    color: Colors.textMain,
    fontSize: 15,
    fontWeight: "500" as const,
    marginTop: 16,
  },
  p: { color: Colors.textMiddle },
  li: { color: Colors.textMiddle },
  strong: { color: Colors.textMain },
  a: { color: Colors.main100 },
});
