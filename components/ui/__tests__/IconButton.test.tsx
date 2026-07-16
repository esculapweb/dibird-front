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
import IconButton from "../IconButton";

const mockOnPress = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

it("renders the icon and calls onPress when pressed", async () => {
  await render(<IconButton icon="heart" onPress={mockOnPress} testID="fav-button" />);

  expect(screen.getByText("heart")).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId("fav-button"));
  expect(mockOnPress).toHaveBeenCalledTimes(1);
});

it("wires no onPress handler while disabled", async () => {
  // fireEvent.press doesn't reliably honor a real onPress: undefined here
  // (same RN/RTL quirk noted in RELEASE_CHECKLIST.md's coverage journal
  // for IconsHeader), so assert on the resolved prop instead of simulating
  // a press.
  await render(
    <IconButton icon="heart" onPress={mockOnPress} disabled testID="fav-button" />,
  );
  expect(screen.getByTestId("fav-button").props.onPress).toBeUndefined();
});

it("renders a spinner instead of the icon while loading, and drops the testID/pressable", async () => {
  await render(<IconButton icon="heart" onPress={mockOnPress} loading testID="fav-button" />);

  expect(screen.queryByText("heart")).not.toBeOnTheScreen();
  expect(screen.queryByTestId("fav-button")).not.toBeOnTheScreen();
});

it("shows the active dot only when active", async () => {
  const { rerender } = await render(
    <IconButton icon="heart" onPress={mockOnPress} testID="fav-button" active={false} />,
  );
  expect(screen.queryByTestId("fav-button-active-dot")).not.toBeOnTheScreen();

  await rerender(
    <IconButton icon="heart" onPress={mockOnPress} testID="fav-button" active />,
  );
  expect(screen.getByTestId("fav-button-active-dot")).toBeOnTheScreen();
});
