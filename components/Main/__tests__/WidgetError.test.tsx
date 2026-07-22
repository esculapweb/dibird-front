jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => <Text>{`icon-${name}`}</Text>,
  };
});

import { fireEvent, render, screen } from "@testing-library/react-native";
import WidgetError from "../WidgetError";

const mockRetry = jest.fn();

beforeEach(() => jest.clearAllMocks());

it("keeps the failed block named, so half the dashboard doesn't vanish namelessly", async () => {
  await render(<WidgetError title="rare_nearby" onRetry={mockRetry} />);

  expect(screen.getByText("rare_nearby")).toBeOnTheScreen();
  expect(screen.getByText("failed_to_load_data")).toBeOnTheScreen();
});

it("retries when tapped", async () => {
  await render(<WidgetError onRetry={mockRetry} testID="widget-error" />);

  await fireEvent.press(screen.getByTestId("widget-error"));
  expect(mockRetry).toHaveBeenCalledTimes(1);
});

it("works without a title, for a block that has no heading of its own", async () => {
  await render(<WidgetError onRetry={mockRetry} />);

  expect(screen.getByText("try_again")).toBeOnTheScreen();
});
