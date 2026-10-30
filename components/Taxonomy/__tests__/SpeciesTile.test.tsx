jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("expo-image", () => {
  const { View } = require("react-native");
  return {
    Image: (props: Record<string, unknown>) => (
      <View testID="tile-image" {...props} />
    ),
  };
});
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return { Ionicons: ({ name }: { name: string }) => <Text>{name}</Text> };
});
jest.mock("../../ui/Svgs", () => {
  const { View } = require("react-native");
  return { BirdSVG: () => <View testID="tile-placeholder" /> };
});

import { StyleSheet } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import SpeciesTile from "../SpeciesTile";

const renderTile = (props: Partial<React.ComponentProps<typeof SpeciesTile>> = {}) =>
  render(
    <SpeciesTile
      title="Osprey"
      thumb="taxon/1a/2e/27921210917.jpg"
      onPress={jest.fn()}
      testID="tile"
      {...props}
    />,
  );

it("shows the photo with the species name over it", async () => {
  await renderTile();

  expect(screen.getByTestId("tile-image").props.source.uri).toContain(
    "taxon/1a/2e/27921210917.jpg",
  );
  expect(screen.getByText("Osprey")).toBeOnTheScreen();
});

it("falls back to the bird placeholder when the species has no photo", async () => {
  await renderTile({ thumb: null });

  expect(screen.getByTestId("tile-placeholder")).toBeOnTheScreen();
  expect(screen.queryByTestId("tile-image")).toBeNull();
});

it("hides the name when captions are off, but keeps it as the label", async () => {
  // VoiceOver and Maestro text selectors still find the bird by name.
  await renderTile({ showCaption: false });

  expect(screen.queryByText("Osprey")).toBeNull();
  expect(screen.getByLabelText("Osprey")).toBeOnTheScreen();
});

it("badges only the notable IUCN categories, captions or not", async () => {
  await renderTile({ statusCode: "EN", showCaption: false });
  expect(screen.getByText("EN")).toBeOnTheScreen();

  await renderTile({ statusCode: "LC" });
  expect(screen.queryByText("LC")).toBeNull();
});

it("opens whatever the host wired to the tile", async () => {
  const onPress = jest.fn();
  await renderTile({ onPress });

  await fireEvent.press(screen.getByTestId("tile"));

  expect(onPress).toHaveBeenCalledTimes(1);
});

describe("on the personal lists", () => {
  it("has no seen mark unless the host can toggle it", async () => {
    await renderTile();

    expect(screen.queryByTestId("tile-seen")).toBeNull();
  });

  it("toggles seen from the corner mark without opening the tile", async () => {
    const onPress = jest.fn();
    const onToggleSeen = jest.fn();
    await renderTile({ seen: false, onPress, onToggleSeen });

    await fireEvent.press(screen.getByTestId("tile-seen"));

    expect(onToggleSeen).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("marks a seen bird and dims an unseen one", async () => {
    await renderTile({ seen: true, onToggleSeen: jest.fn() });
    expect(screen.getByText("checkmark")).toBeOnTheScreen();
    expect(
      StyleSheet.flatten(screen.getByTestId("tile").props.style).opacity,
    ).toBeUndefined();

    await renderTile({ seen: false, onToggleSeen: jest.fn() });
    expect(screen.getByText("ellipse-outline")).toBeOnTheScreen();
    expect(
      StyleSheet.flatten(screen.getByTestId("tile").props.style).opacity,
    ).toBeLessThan(1);
  });
});
