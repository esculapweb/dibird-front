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

import { fireEvent, render, screen } from "@testing-library/react-native";
import TerritoryRow from "../TerritoryRow";

it("shows the country flag, its name and the species count", async () => {
  await render(
    <TerritoryRow
      name="Argentina"
      code="AR"
      speciesLabel="1111 species"
      onPress={jest.fn()}
    />,
  );

  expect(screen.getByText("Argentina")).toBeOnTheScreen();
  expect(screen.getByText("1111 species")).toBeOnTheScreen();
  // "AR" as regional-indicator letters.
  expect(screen.getByText("🇦🇷")).toBeOnTheScreen();
});

it("falls back to a globe for the territories that have no ISO code", async () => {
  await render(<TerritoryRow name="High Seas" code={null} onPress={jest.fn()} />);

  expect(screen.getByTestId("icon-globe-outline")).toBeOnTheScreen();
});

it("leaves the second line out when the count is missing", async () => {
  // The count comes from a precomputed table and is occasionally absent.
  await render(<TerritoryRow name="Austria" code="AT" onPress={jest.fn()} />);

  expect(screen.getByText("Austria")).toBeOnTheScreen();
  expect(screen.queryByText(/species/)).toBeNull();
});

it("opens the country when tapped", async () => {
  const onPress = jest.fn();
  await render(<TerritoryRow name="Austria" code="AT" onPress={onPress} />);

  await fireEvent.press(screen.getByText("Austria"));
  expect(onPress).toHaveBeenCalled();
});
