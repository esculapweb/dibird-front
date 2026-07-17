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
jest.mock("@react-navigation/native", () => ({ useNavigation: () => mockNavigation }));
jest.mock("../ChecklistHeroSkeleton", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: () => <View testID="checklist-hero-skeleton" /> };
});

import { fireEvent, render, screen } from "@testing-library/react-native";
import { createNavigationMock } from "../../../screens/test-utils";
import ChecklistHero from "../ChecklistHero";
import { DashboardStat, Filters, TerritoryDropdownItem } from "../../../types";

const mockNavigation = createNavigationMock();

const DATA: DashboardStat = { seen: 25, observations: 0, diaries: 0, rank: 0, total: 100 };

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows a skeleton while loading", async () => {
  await render(<ChecklistHero data={undefined} filters={{}} isLoading />);
  expect(screen.getByTestId("checklist-hero-skeleton")).toBeOnTheScreen();
});

it("renders nothing once done loading without data", async () => {
  await render(<ChecklistHero data={undefined} filters={{}} isLoading={false} />);
  expect(screen.queryByTestId("checklist-hero-skeleton")).not.toBeOnTheScreen();
  expect(screen.queryByText("checklist", { exact: false })).not.toBeOnTheScreen();
});

it("shows the seen/total counts", async () => {
  await render(<ChecklistHero data={DATA} filters={{}} isLoading={false} />);
  expect(screen.getByText("25")).toBeOnTheScreen();
  expect(screen.getByText("of 100", { exact: false })).toBeOnTheScreen();
});

describe("country label", () => {
  it("falls back to 'all_countries' without a country", async () => {
    await render(<ChecklistHero data={DATA} filters={{}} isLoading={false} />);
    expect(screen.getByText("all_countries", { exact: false })).toBeOnTheScreen();
  });

  it("shows the country's label when given", async () => {
    await render(
      <ChecklistHero
        data={DATA}
        filters={{}}
        isLoading={false}
        country={{ label: "France" } as TerritoryDropdownItem}
      />,
    );
    expect(screen.getByText("France", { exact: false })).toBeOnTheScreen();
    expect(screen.queryByText("all_countries", { exact: false })).not.toBeOnTheScreen();
  });
});

it("navigates to Checklist with the current filters and seenMode 'all'", async () => {
  const filters: Filters = { territory: 5 };
  await render(<ChecklistHero data={DATA} filters={filters} isLoading={false} />);
  await fireEvent.press(screen.getByText("25"));

  expect(mockNavigation.navigate).toHaveBeenCalledWith("Checklist", {
    filtersOverride: filters,
    seenMode: "all",
  });
});
