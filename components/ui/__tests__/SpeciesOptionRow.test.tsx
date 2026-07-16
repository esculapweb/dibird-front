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
      <View testID="species-option-image" accessibilityValue={{ text: source.uri }} />
    ),
  };
});
jest.mock("../Svgs", () => {
  const { View } = require("react-native");
  return { BirdSVG: () => <View testID="species-option-placeholder" /> };
});

import { fireEvent, render, screen } from "@testing-library/react-native";
import SpeciesOptionRow from "../SpeciesOptionRow";
import { SpeciesDropdownItem } from "../../../types";

const mockOnSelect = jest.fn();
const mockOnClose = jest.fn();

const baseItem = (overrides: Partial<SpeciesDropdownItem> = {}): SpeciesDropdownItem => ({
  value: 3,
  label: "Blue Tit",
  name_lang: "Blue Tit",
  name: "Cyanistes caeruleus",
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows the translated name", async () => {
  await render(
    <SpeciesOptionRow item={baseItem()} selected={null} onSelect={mockOnSelect} onClose={mockOnClose} />,
  );
  expect(screen.getByText("Blue Tit")).toBeOnTheScreen();
});

it("shows the latin name only when it differs from the translated name", async () => {
  await render(
    <SpeciesOptionRow item={baseItem()} selected={null} onSelect={mockOnSelect} onClose={mockOnClose} />,
  );
  expect(screen.getByText("Cyanistes caeruleus", { exact: false })).toBeOnTheScreen();

  await render(
    <SpeciesOptionRow
      item={baseItem({ name: "Blue Tit" })}
      selected={null}
      onSelect={mockOnSelect}
      onClose={mockOnClose}
    />,
  );
  expect(screen.queryByText("Cyanistes caeruleus", { exact: false })).not.toBeOnTheScreen();
});

describe("thumbnail", () => {
  it("shows the thumbnail image when set", async () => {
    await render(
      <SpeciesOptionRow
        item={baseItem({ thumb: "species/3/thumb.jpg" })}
        selected={null}
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />,
    );
    expect(screen.getByTestId("species-option-image").props.accessibilityValue.text).toBe(
      "https://test.local/media/species/3/thumb.jpg",
    );
    expect(screen.queryByTestId("species-option-placeholder")).not.toBeOnTheScreen();
  });

  it("falls back to a placeholder icon without a thumbnail", async () => {
    await render(
      <SpeciesOptionRow item={baseItem()} selected={null} onSelect={mockOnSelect} onClose={mockOnClose} />,
    );
    expect(screen.getByTestId("species-option-placeholder")).toBeOnTheScreen();
    expect(screen.queryByTestId("species-option-image")).not.toBeOnTheScreen();
  });
});

describe("seen indicator", () => {
  it("shows the eye icon only when the species has been seen", async () => {
    const { rerender } = await render(
      <SpeciesOptionRow item={baseItem({ seen: false })} selected={null} onSelect={mockOnSelect} onClose={mockOnClose} />,
    );
    expect(screen.queryByText("eye-outline")).not.toBeOnTheScreen();

    await rerender(
      <SpeciesOptionRow item={baseItem({ seen: true })} selected={null} onSelect={mockOnSelect} onClose={mockOnClose} />,
    );
    expect(screen.getByText("eye-outline")).toBeOnTheScreen();
  });
});

describe("selection", () => {
  it("calls onSelect and onClose when pressed", async () => {
    await render(
      <SpeciesOptionRow item={baseItem()} selected={null} onSelect={mockOnSelect} onClose={mockOnClose} />,
    );
    await fireEvent.press(screen.getByText("Blue Tit"));
    expect(mockOnSelect).toHaveBeenCalledWith(3);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("does nothing while disabled", async () => {
    await render(
      <SpeciesOptionRow
        item={baseItem()}
        selected={null}
        onSelect={mockOnSelect}
        onClose={mockOnClose}
        disabled
      />,
    );
    await fireEvent.press(screen.getByText("Blue Tit"));
    expect(mockOnSelect).not.toHaveBeenCalled();
    expect(mockOnClose).not.toHaveBeenCalled();
  });
});

it("sets a testID from the index when given", async () => {
  await render(
    <SpeciesOptionRow item={baseItem()} selected={null} onSelect={mockOnSelect} onClose={mockOnClose} index={4} />,
  );
  expect(screen.getByTestId("option-row-4")).toBeOnTheScreen();
});
