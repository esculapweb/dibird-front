jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name, testID }: { name: string; testID?: string }) => (
      <Text testID={testID ?? `icon-${name}`}>{name}</Text>
    ),
  };
});
jest.mock("expo-haptics", () => ({ selectionAsync: jest.fn() }));

import { fireEvent, render, screen } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import Tabs from "../Tabs";
import { TabOption } from "../../../types";

const TAB_OPTIONS: TabOption[] = [
  { value: "seen", icon: "eye", iconInactive: "eye-outline", labelKey: "Seen" },
  { value: "unseen", icon: "eye-off", iconInactive: "eye-off-outline", labelKey: "Unseen", count: 3 },
  { value: "all", icon: "list", iconInactive: "list-outline", labelKey: "All", count: 42 },
];

const mockSetTabsMode = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

it("renders a label for every tab option", async () => {
  await render(<Tabs tabOptions={TAB_OPTIONS} tabsMode="seen" setTabsMode={mockSetTabsMode} />);
  expect(screen.getByText("Seen")).toBeOnTheScreen();
  expect(screen.getByText("Unseen")).toBeOnTheScreen();
  expect(screen.getByText("All")).toBeOnTheScreen();
});

it("shows the active icon for the current mode and the inactive icon for the rest", async () => {
  await render(<Tabs tabOptions={TAB_OPTIONS} tabsMode="unseen" setTabsMode={mockSetTabsMode} />);
  expect(screen.getByText("eye-outline")).toBeOnTheScreen();
  expect(screen.getByText("eye-off")).toBeOnTheScreen();
  expect(screen.getByText("list-outline")).toBeOnTheScreen();
});

it("shows a count badge only for options that have one", async () => {
  await render(<Tabs tabOptions={TAB_OPTIONS} tabsMode="seen" setTabsMode={mockSetTabsMode} />);
  expect(screen.getByText("3")).toBeOnTheScreen();
  expect(screen.getByText("42")).toBeOnTheScreen();
});

it("caps a very large count at '999+'", async () => {
  const options: TabOption[] = [
    { value: "all", icon: "list", iconInactive: "list-outline", labelKey: "All", count: 1000 },
  ];
  await render(<Tabs tabOptions={options} tabsMode="all" setTabsMode={mockSetTabsMode} />);
  expect(screen.getByText("999+")).toBeOnTheScreen();
});

it("fires a haptic and switches mode when a tab is pressed", async () => {
  await render(<Tabs tabOptions={TAB_OPTIONS} tabsMode="seen" setTabsMode={mockSetTabsMode} />);
  await fireEvent.press(screen.getByText("Unseen"));

  expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  expect(mockSetTabsMode).toHaveBeenCalledWith("unseen");
});
