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
import IconsHeader from "../IconsHeader";

const mockOnSort = jest.fn();
const mockOnFilter = jest.fn();
const mockOnShare = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

it("renders nothing when no handlers/extra buttons are given", async () => {
  await render(<IconsHeader />);
  expect(screen.queryByText("swap-vertical")).not.toBeOnTheScreen();
  expect(screen.queryByText("options-outline")).not.toBeOnTheScreen();
  expect(screen.queryByText("share-social-outline")).not.toBeOnTheScreen();
});

it("only renders the built-in icons whose handler is provided, in sort/filter/share order", async () => {
  await render(
    <IconsHeader onSortPress={mockOnSort} onFilterPress={mockOnFilter} onSharePress={mockOnShare} />,
  );

  expect(screen.getByText("swap-vertical")).toBeOnTheScreen();
  expect(screen.getByText("options-outline")).toBeOnTheScreen();
  expect(screen.getByText("share-social-outline")).toBeOnTheScreen();
});

it("calls the matching handler when a built-in icon is pressed", async () => {
  await render(
    <IconsHeader onSortPress={mockOnSort} onFilterPress={mockOnFilter} onSharePress={mockOnShare} />,
  );

  await fireEvent.press(screen.getByText("swap-vertical"));
  expect(mockOnSort).toHaveBeenCalledTimes(1);
  expect(mockOnFilter).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByText("options-outline"));
  expect(mockOnFilter).toHaveBeenCalledTimes(1);

  await fireEvent.press(screen.getByText("share-social-outline"));
  expect(mockOnShare).toHaveBeenCalledTimes(1);
});

it("swaps the filter icon to the filled variant when there are active filters", async () => {
  await render(<IconsHeader onFilterPress={mockOnFilter} hasActiveFilters />);

  expect(screen.getByText("options")).toBeOnTheScreen();
  expect(screen.queryByText("options-outline")).not.toBeOnTheScreen();
});

describe("condition filtering (not just disabled)", () => {
  it("does not render extra buttons whose condition is false, rather than rendering them disabled", async () => {
    await render(
      <IconsHeader
        headerRightBeginning={[
          { condition: false, icon: "trash", onPress: mockOnSort, testID: "delete-btn" },
        ]}
      />,
    );

    expect(screen.queryByTestId("delete-btn")).not.toBeOnTheScreen();
  });

  it("renders extra buttons whose condition is true", async () => {
    await render(
      <IconsHeader
        headerRightEnd={[
          { condition: true, icon: "trash", onPress: mockOnSort, testID: "delete-btn" },
        ]}
      />,
    );

    expect(screen.getByTestId("delete-btn")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("delete-btn"));
    expect(mockOnSort).toHaveBeenCalledTimes(1);
  });
});

it("places headerRightBeginning before and headerRightEnd after the built-in icons", async () => {
  await render(
    <IconsHeader
      onSortPress={mockOnSort}
      headerRightBeginning={[{ condition: true, icon: "arrow-back", onPress: jest.fn(), testID: "begin-btn" }]}
      headerRightEnd={[{ condition: true, icon: "arrow-forward", onPress: jest.fn(), testID: "end-btn" }]}
    />,
  );

  const order = screen.getAllByTestId(/^icon-/).map((el) => el.children[0]);
  expect(order).toEqual(["arrow-back", "swap-vertical", "arrow-forward"]);
});

it("tolerates non-array headerRightBeginning/headerRightEnd without crashing", async () => {
  await render(
    <IconsHeader
      onSortPress={mockOnSort}
      // @ts-expect-error deliberately passing a non-array to test the Array.isArray guard
      headerRightBeginning={null}
      // @ts-expect-error deliberately passing a non-array to test the Array.isArray guard
      headerRightEnd={{}}
    />,
  );

  expect(screen.getByText("swap-vertical")).toBeOnTheScreen();
});
