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

const mockNavigation = createNavigationMock();

beforeEach(() => {
  jest.clearAllMocks();
});

it("renders all 7 section buttons with translated labels", async () => {
  await render(<Sections />);
  for (const key of [
    "observations",
    "places",
    "statistics",
    "diaries",
    "rating",
    "checklist",
    "species_catalog",
  ]) {
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
    await render(<Sections />);
    await fireEvent.press(screen.getByTestId(`section-${key}`));
    expect(mockNavigation.navigate).toHaveBeenCalledWith(key);
  });
});

it("navigates to the species catalog (Taxonomy, orders) when tapped", async () => {
  await render(<Sections />);
  await fireEvent.press(screen.getByTestId("section-Taxonomy"));
  expect(mockNavigation.navigate).toHaveBeenCalledWith("Taxonomy", { rank: 2 });
});
