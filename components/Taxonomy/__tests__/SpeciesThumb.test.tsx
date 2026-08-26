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
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("../../ui/Svgs", () => {
  const { View } = require("react-native");
  return { BirdSVG: () => <View testID="thumb-placeholder" /> };
});

import { StyleSheet } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
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

// The app-wide rule: the bird's picture leads to the bird, the rest of the row
// leads to whatever the row is about.
describe("as a way into the species page", () => {
  it("is a button only when a handler is given", async () => {
    const onPress = jest.fn();

    await render(<SpeciesThumb thumb={null} onPress={onPress} testID="thumb" />);
    await fireEvent.press(screen.getByTestId("thumb"));

    expect(onPress).toHaveBeenCalled();
  });

  // Labelled by what it does, not by the bird it shows: the row it sits in
  // already carries the name, and repeating it there gave the row two elements
  // reading the same thing — one of which quietly went somewhere else.
  it("announces itself as the way to the species page, not as the bird", async () => {
    await render(
      <SpeciesThumb thumb={null} onPress={jest.fn()} testID="thumb" />,
    );

    expect(screen.getByTestId("thumb").props.accessibilityLabel).toBe(
      "species_details",
    );
  });

  // A Pressable without a handler would still swallow the row's own press on
  // the thumb, which is exactly what a plain photo must not do.
  it("stays a plain view without one", async () => {
    await render(<SpeciesThumb thumb={null} testID="thumb" />);

    expect(screen.queryByTestId("thumb")).toBeNull();
  });
});
