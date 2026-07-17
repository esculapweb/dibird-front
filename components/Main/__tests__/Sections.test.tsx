jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("../../../hooks/useContentWidth", () => ({ useContentWidth: () => 400 }));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name, testID }: { name: string; testID?: string }) => (
      <Text testID={testID ?? `icon-${name}`}>{name}</Text>
    ),
  };
});
jest.mock("@react-navigation/native", () => ({ useNavigation: () => mockNavigation }));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { createNavigationMock } from "../../../screens/test-utils";
import Sections from "../Sections";
import { DashboardStat } from "../../../types";

const mockNavigation = createNavigationMock();

const DATA: DashboardStat = { seen: 1, observations: 2, diaries: 5, rank: 1, total: 10 };

beforeEach(() => {
  jest.clearAllMocks();
});

it("renders all 6 section buttons with translated labels", async () => {
  await render(<Sections data={DATA} />);
  for (const key of ["observations", "places", "statistics", "diaries", "rating", "checklist"]) {
    expect(screen.getByText(key)).toBeOnTheScreen();
  }
});

describe.each([
  ["Observations"],
  ["Places"],
  ["Stat"],
  ["Diaries"],
  ["Rating"],
  ["Checklist"],
] as const)("%s section", (key) => {
  it(`navigates to ${key} when tapped`, async () => {
    await render(<Sections data={DATA} />);
    await fireEvent.press(screen.getByTestId(`section-${key}`));
    expect(mockNavigation.navigate).toHaveBeenCalledWith(key);
  });
});

it("never shows a badge, even on Diaries with diaries > 0 (showBadge is hardcoded false)", async () => {
  await render(<Sections data={{ ...DATA, diaries: 99 }} />);
  expect(screen.queryByText("99")).not.toBeOnTheScreen();
});
