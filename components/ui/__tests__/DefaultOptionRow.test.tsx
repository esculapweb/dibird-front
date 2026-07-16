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

import { fireEvent, render, screen } from "@testing-library/react-native";
import DefaultOptionRow from "../DefaultOptionRow";
import { DropdownItem } from "../../../types";

const mockOnSelect = jest.fn();
const mockOnClose = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

it("renders the option's label", async () => {
  const item: DropdownItem = { value: 1, label: "France" };
  await render(
    <DefaultOptionRow item={item} selected={null} onSelect={mockOnSelect} onClose={mockOnClose} itemHeight={52} />,
  );
  expect(screen.getByText("France")).toBeOnTheScreen();
});

it("selects the option and closes the modal when pressed", async () => {
  const item: DropdownItem = { value: 1, label: "France" };
  await render(
    <DefaultOptionRow item={item} selected={null} onSelect={mockOnSelect} onClose={mockOnClose} itemHeight={52} />,
  );
  await fireEvent.press(screen.getByText("France"));
  expect(mockOnSelect).toHaveBeenCalledWith(1);
  expect(mockOnClose).toHaveBeenCalledTimes(1);
});

it("sets a testID from the index when given, and none when omitted", async () => {
  const item: DropdownItem = { value: 1, label: "France" };
  const { rerender } = await render(
    <DefaultOptionRow item={item} selected={null} onSelect={mockOnSelect} onClose={mockOnClose} itemHeight={52} index={2} />,
  );
  expect(screen.getByTestId("option-row-2")).toBeOnTheScreen();

  await rerender(
    <DefaultOptionRow item={item} selected={null} onSelect={mockOnSelect} onClose={mockOnClose} itemHeight={52} />,
  );
  expect(screen.queryByTestId("option-row-2")).not.toBeOnTheScreen();
});

describe("icons", () => {
  it("shows the emoji icon as plain text when set", async () => {
    const item: DropdownItem = { value: 1, label: "France", icon: "🇫🇷" };
    await render(
      <DefaultOptionRow item={item} selected={null} onSelect={mockOnSelect} onClose={mockOnClose} itemHeight={52} />,
    );
    expect(screen.getByText("🇫🇷")).toBeOnTheScreen();
  });

  it("shows an Ionicons iconLabel and iconLabelRight when set", async () => {
    const item: DropdownItem = { value: 1, label: "Robin", iconLabel: "star", iconLabelRight: "checkmark" };
    await render(
      <DefaultOptionRow item={item} selected={null} onSelect={mockOnSelect} onClose={mockOnClose} itemHeight={52} />,
    );
    expect(screen.getByText("star")).toBeOnTheScreen();
    expect(screen.getByText("checkmark")).toBeOnTheScreen();
  });
});

describe("distance", () => {
  it("shows a formatted distance when it's a valid number", async () => {
    const item: DropdownItem = { value: 1, label: "France", distance: 2500 };
    await render(
      <DefaultOptionRow item={item} selected={null} onSelect={mockOnSelect} onClose={mockOnClose} itemHeight={52} />,
    );
    expect(screen.getByText("~2.5 km", { exact: false })).toBeOnTheScreen();
  });

  it("hides the distance when it's null", async () => {
    const item: DropdownItem = { value: 1, label: "France", distance: null };
    await render(
      <DefaultOptionRow item={item} selected={null} onSelect={mockOnSelect} onClose={mockOnClose} itemHeight={52} />,
    );
    expect(screen.queryByText("km", { exact: false })).not.toBeOnTheScreen();
  });

  it("hides the distance when it's NaN", async () => {
    const item: DropdownItem = { value: 1, label: "France", distance: NaN };
    await render(
      <DefaultOptionRow item={item} selected={null} onSelect={mockOnSelect} onClose={mockOnClose} itemHeight={52} />,
    );
    expect(screen.queryByText("km", { exact: false })).not.toBeOnTheScreen();
  });
});
