jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("expo-image", () => {
  const { View } = require("react-native");
  return {
    Image: (props: Record<string, unknown>) => (
      <View testID="species-thumb" {...props} />
    ),
  };
});
jest.mock("../../ui/Svgs", () => {
  const { View } = require("react-native");
  return { BirdSVG: () => <View testID="thumb-placeholder" /> };
});

import { StyleSheet } from "react-native";
import { render, screen } from "@testing-library/react-native";
import SpeciesThumb from "../SpeciesThumb";

const badgeStyle = (code: string) =>
  StyleSheet.flatten(screen.getByText(code).props.style);

it("resolves a stored path against the media host", async () => {
  await render(<SpeciesThumb thumb="taxon/1a/2e/27921210917.jpg" />);

  expect(screen.getByTestId("species-thumb").props.source.uri).toContain(
    "taxon/1a/2e/27921210917.jpg",
  );
});

it("falls back to the bird placeholder when the species has no photo", async () => {
  await render(<SpeciesThumb thumb={null} />);

  expect(screen.getByTestId("thumb-placeholder")).toBeOnTheScreen();
  expect(screen.queryByTestId("species-thumb")).toBeNull();
});

it("puts the IUCN badge of a threatened species on the photo", async () => {
  await render(<SpeciesThumb thumb={null} statusCode="EN" />);

  // Endangered orange, on white — the Red List's own colours.
  expect(badgeStyle("EN").color).toBe("#FFFFFF");
});

it("skips the badge for the categories that say nothing", async () => {
  // ~90% of a catalogue is "least concern"; the two no-data categories are
  // just as uninformative, and the row's width belongs to the species name.
  for (const code of ["LC", "DD", "NE"]) {
    await render(<SpeciesThumb thumb={null} statusCode={code} />);
    expect(screen.queryByText(code)).toBeNull();
  }
});

it("shows every threatened category, extinct ones included", async () => {
  for (const code of ["NT", "VU", "EN", "CR", "EW", "EX"]) {
    await render(<SpeciesThumb thumb={null} statusCode={code} />);
    expect(screen.getByText(code)).toBeOnTheScreen();
  }
});

it("keeps the qualifier form of a category on the badge", async () => {
  // "CR (PE)" — possibly extinct — is a qualifier on CR, not its own category.
  await render(<SpeciesThumb thumb={null} statusCode="CR (PE)" />);

  expect(screen.getByText("CR (PE)")).toBeOnTheScreen();
});
