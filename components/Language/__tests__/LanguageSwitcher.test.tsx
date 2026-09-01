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
    Ionicons: ({ name, testID }: { name: string; testID?: string }) => (
      <Text testID={testID ?? `icon-${name}`}>{name}</Text>
    ),
  };
});
jest.mock("../../../store/language-context", () => ({ useLanguage: jest.fn() }));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { useLanguage } from "../../../store/language-context";
import { mockColors } from "../../../screens/mockTheme";
import LanguageSwitcher from "../LanguageSwitcher";

const mockChangeLanguage = jest.fn();

const mockLanguage = (language: string) => {
  (useLanguage as jest.Mock).mockReturnValue({ language, changeLanguage: mockChangeLanguage });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockLanguage("en");
});

it("shows the language label and both language options", async () => {
  await render(<LanguageSwitcher />);
  expect(screen.getByText("language:", { exact: false })).toBeOnTheScreen();
  expect(screen.getByText("EN")).toBeOnTheScreen();
  expect(screen.getByText("RU")).toBeOnTheScreen();
});

it("highlights the currently active language", async () => {
  mockLanguage("ru");
  await render(<LanguageSwitcher />);

  const ruButton = screen.getByText("RU").parent;
  const enButton = screen.getByText("EN").parent;
  expect(ruButton?.props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ backgroundColor: mockColors.main100 })]),
  );
  expect(enButton?.props.style).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ backgroundColor: mockColors.main100 })]),
  );
});

it("calls changeLanguage with the tapped language", async () => {
  await render(<LanguageSwitcher />);
  await fireEvent.press(screen.getByText("RU"));
  expect(mockChangeLanguage).toHaveBeenCalledWith("ru");
});

// The Settings copy of the switcher has to line up with the rows around it: no
// divider of its own and no trailing colon, which the drawer footer does need.
it("drops the drawer chrome in the settings variant", async () => {
  await render(<LanguageSwitcher variant="settings" />);
  expect(screen.getByText("language")).toBeOnTheScreen();
  expect(screen.queryByText("language:")).not.toBeOnTheScreen();
});
