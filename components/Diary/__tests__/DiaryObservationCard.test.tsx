jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name, testID }: { name: string; testID?: string }) => (
      <Text testID={testID ?? `icon-${name}`}>{name}</Text>
    ),
  };
});
jest.mock("expo-image", () => {
  const { View } = require("react-native");
  return {
    Image: ({ source }: { source: { uri: string } }) => (
      <View testID="species-thumb" accessibilityValue={{ text: source.uri }} />
    ),
  };
});
jest.mock("../../ui/Svgs", () => {
  const { View } = require("react-native");
  return { BirdSVG: () => <View testID="species-thumb-placeholder" /> };
});
jest.mock("@react-navigation/native", () => ({ useNavigation: () => mockNavigation }));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { createNavigationMock } from "../../../screens/test-utils";
import DiaryObservationCard from "../DiaryObservationCard";
import { DiaryObservationItem } from "../../../types";

const mockNavigation = createNavigationMock();

const ITEM = (overrides: Partial<DiaryObservationItem> = {}): DiaryObservationItem =>
  ({
    id: 5,
    created_at: "2026-01-01T08:00:00Z",
    notes: null,
    quantity: null,
    time: null,
    species_data: {
      id: 1,
      name: "Cyanistes caeruleus",
      name_lang: "Blue Tit",
      segment: "blue-tit",
      thumb: null,
    },
    ...overrides,
  }) as DiaryObservationItem;

beforeEach(() => {
  jest.clearAllMocks();
});

it("renders the 1-based index and species name", async () => {
  await render(<DiaryObservationCard item={ITEM()} index={2} owner />);
  expect(screen.getByText("3.")).toBeOnTheScreen();
  expect(screen.getByText("Blue Tit")).toBeOnTheScreen();
  expect(screen.getByText("Cyanistes caeruleus")).toBeOnTheScreen();
});

describe("thumbnail", () => {
  it("shows the species image when a thumb is set", async () => {
    await render(<DiaryObservationCard item={ITEM({ species_data: { id: 1, name: "x", name_lang: "x", segment: "x", thumb: "species/1/t.jpg" } })} index={0} owner />);
    expect(screen.getByTestId("species-thumb").props.accessibilityValue.text).toBe(
      "https://test.local/media/species/1/t.jpg",
    );
  });

  it("falls back to a placeholder without a thumb", async () => {
    await render(<DiaryObservationCard item={ITEM()} index={0} owner />);
    expect(screen.getByTestId("species-thumb-placeholder")).toBeOnTheScreen();
    expect(screen.queryByTestId("species-thumb")).not.toBeOnTheScreen();
  });
});

describe("optional meta", () => {
  it("shows the notes icon only when notes are present", async () => {
    const { rerender } = await render(<DiaryObservationCard item={ITEM()} index={0} owner />);
    expect(screen.queryByText("document-text-outline")).not.toBeOnTheScreen();

    await rerender(<DiaryObservationCard item={ITEM({ notes: "seen at dawn" })} index={0} owner />);
    expect(screen.getByText("document-text-outline")).toBeOnTheScreen();
  });

  it("shows the quantity badge only when quantity is set", async () => {
    const { rerender } = await render(<DiaryObservationCard item={ITEM()} index={0} owner />);
    expect(screen.queryByText("time-outline")).not.toBeOnTheScreen();

    await rerender(<DiaryObservationCard item={ITEM({ quantity: 4 })} index={0} owner />);
    expect(screen.getByText("4")).toBeOnTheScreen();
  });

  it("shows the formatted time only when time is set", async () => {
    await render(<DiaryObservationCard item={ITEM({ time: "9:5" })} index={0} owner />);
    expect(screen.getByText("09:05")).toBeOnTheScreen();
    expect(screen.getByText("time-outline")).toBeOnTheScreen();
  });
});

describe("navigation on tap", () => {
  it("navigates to ObservationDetail when the viewer owns the diary", async () => {
    await render(<DiaryObservationCard item={ITEM()} index={0} owner />);
    await fireEvent.press(screen.getByText("Blue Tit"));
    expect(mockNavigation.navigate).toHaveBeenCalledWith("ObservationDetail", { observationId: 5 });
  });

  it("navigates to CommunityDetail when the viewer doesn't own the diary", async () => {
    await render(<DiaryObservationCard item={ITEM()} index={0} owner={false} />);
    await fireEvent.press(screen.getByText("Blue Tit"));
    expect(mockNavigation.navigate).toHaveBeenCalledWith("CommunityDetail", { observationId: 5 });
  });
});
