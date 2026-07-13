jest.mock("../../../store/theme-context", () => ({
  useTheme: () => ({
    Colors: {
      primary100: "#fff",
      textMain: "#000",
      textSecondary: "#666",
      border: "#ccc",
    },
  }),
}));

import { render, screen, fireEvent } from "@testing-library/react-native";
import StatCard from "../StatCard";

it("renders the value and label", async () => {
  await render(<StatCard value={42} label="Species" onPress={() => {}} />);
  expect(screen.getByText("42")).toBeOnTheScreen();
  expect(screen.getByText("Species")).toBeOnTheScreen();
});

it("calls onPress when tapped", async () => {
  const onPress = jest.fn();
  await render(<StatCard value={1} label="Seen" onPress={onPress} />);
  fireEvent.press(screen.getByText("Seen"));
  expect(onPress).toHaveBeenCalledTimes(1);
});
