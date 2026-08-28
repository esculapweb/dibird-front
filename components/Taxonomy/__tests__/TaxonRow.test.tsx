jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => (
      <Text testID={`icon-${name}`}>{name}</Text>
    ),
  };
});
jest.mock("expo-image", () => {
  const { View } = require("react-native");
  return {
    Image: (props: Record<string, unknown>) => (
      <View testID="taxon-thumb" {...props} />
    ),
  };
});
jest.mock("../../ui/Svgs", () => {
  const { View } = require("react-native");
  return { BirdSVG: () => <View testID="thumb-placeholder" /> };
});

import { StyleSheet } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import TaxonRow from "../TaxonRow";

const renderRow = (props: Partial<React.ComponentProps<typeof TaxonRow>> = {}) =>
  render(
    <TaxonRow
      title="Osprey"
      latin="Pandion haliaetus"
      onPress={props.onPress ?? jest.fn()}
      {...props}
    />,
  );

const badgeStyle = (code: string) =>
  StyleSheet.flatten(screen.getByText(code).props.style);

it("shows the localized name with the scientific one under it", async () => {
  await renderRow();

  expect(screen.getByText("Osprey")).toBeOnTheScreen();
  expect(screen.getByText("Pandion haliaetus")).toBeOnTheScreen();
});

it("leaves out the second line when latinPart found nothing to add", async () => {
  // Genera and families come back as a bare latin name, so the row would
  // otherwise print it twice.
  await renderRow({ title: "Pandion", latin: "" });

  expect(screen.getAllByText("Pandion")).toHaveLength(1);
});

it("resolves a species thumb against the media host", async () => {
  // Species rows come from a .values() queryset, i.e. a raw stored path.
  await renderRow({ thumb: "taxon/1a/2e/27921210917.jpg" });

  expect(screen.getByTestId("taxon-thumb").props.source).toEqual({
    uri: "https://test.local/media/taxon/1a/2e/27921210917.jpg",
  });
});

it("keeps an already absolute thumb as it is", async () => {
  // Group lists are serialized by an ImageField, which hands over a full url.
  await renderRow({ thumb: "https://live.staticflickr.com/1/2_c.jpg" });

  expect(screen.getByTestId("taxon-thumb").props.source).toEqual({
    uri: "https://live.staticflickr.com/1/2_c.jpg",
  });
});

it("falls back to the bird placeholder when the taxon has no photo", async () => {
  await renderRow({ thumb: null });

  expect(screen.getByTestId("thumb-placeholder")).toBeOnTheScreen();
  expect(screen.queryByTestId("taxon-thumb")).toBeNull();
});

it("paints the status badge in its IUCN category colour", async () => {
  await renderRow({ statusCode: "VU" });

  expect(badgeStyle("VU").color).toBe("#1E2A36");
});

it("switches the badge text to white on the dark categories", async () => {
  await renderRow({ statusCode: "CR" });

  expect(badgeStyle("CR").color).toBe("#FFFFFF");
});

it("keeps the badge off the ranks that have no IUCN status", async () => {
  await renderRow({ title: "Accipitridae", statusCode: null });

  expect(screen.queryByText("LC")).toBeNull();
});

it("adds the occurrence line the country lists carry", async () => {
  await renderRow({ occurrence: "Редкий / залётный" });

  expect(screen.getByText("Редкий / залётный")).toBeOnTheScreen();
});

it("opens the taxon when the row is tapped", async () => {
  const onPress = jest.fn();
  await renderRow({ onPress });

  await fireEvent.press(screen.getByText("Osprey"));

  expect(onPress).toHaveBeenCalled();
});
