jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name, testID }: { name: string; testID?: string }) => (
      <Text testID={testID ?? `icon-${name}`}>{name}</Text>
    ),
  };
});
jest.mock("../../../store/theme-context", () => ({ useTheme: jest.fn() }));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { useTheme } from "../../../store/theme-context";
import { mockColors } from "../../../screens/mockTheme";
import ThemeSwitcher from "../ThemeSwitcher";

const mockToggleTheme = jest.fn();

const mockManualTheme = (manualTheme: "light" | "dark" | null) => {
  (useTheme as jest.Mock).mockReturnValue({
    manualTheme,
    toggleTheme: mockToggleTheme,
    Colors: mockColors,
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockManualTheme(null);
});

it("shows the theme label, an 'auto' text option, and light/dark icon options", async () => {
  await render(<ThemeSwitcher />);
  expect(screen.getByText("theme:", { exact: false })).toBeOnTheScreen();
  expect(screen.getByText("auto")).toBeOnTheScreen();
  expect(screen.getByText("sunny-outline")).toBeOnTheScreen();
  expect(screen.getByText("moon-outline")).toBeOnTheScreen();
});

it("highlights the currently active option", async () => {
  mockManualTheme("dark");
  await render(<ThemeSwitcher />);

  const darkButton = screen.getByText("moon-outline").parent;
  const lightButton = screen.getByText("sunny-outline").parent;
  expect(darkButton?.props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ backgroundColor: mockColors.main100 })]),
  );
  expect(lightButton?.props.style).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ backgroundColor: mockColors.main100 })]),
  );
});

describe("selecting an option", () => {
  it("calls toggleTheme(null) for auto", async () => {
    await render(<ThemeSwitcher />);
    await fireEvent.press(screen.getByText("auto"));
    expect(mockToggleTheme).toHaveBeenCalledWith(null);
  });

  it("calls toggleTheme('light') / toggleTheme('dark') for the icon options", async () => {
    await render(<ThemeSwitcher />);
    await fireEvent.press(screen.getByText("sunny-outline"));
    expect(mockToggleTheme).toHaveBeenCalledWith("light");

    await fireEvent.press(screen.getByText("moon-outline"));
    expect(mockToggleTheme).toHaveBeenCalledWith("dark");
  });
});

// The Settings copy of the switcher has to line up with the rows around it: no
// divider of its own and no trailing colon, which the drawer footer does need.
it("drops the drawer chrome in the settings variant", async () => {
  await render(<ThemeSwitcher variant="settings" />);
  expect(screen.getByText("theme")).toBeOnTheScreen();
  expect(screen.queryByText("theme:")).not.toBeOnTheScreen();
});
