jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("@react-navigation/native", () => ({ useNavigation: () => mockNavigation }));

const mockStatCardCapture = jest.fn();
jest.mock("../../ui/StatCard", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockStatCardCapture(props);
    return null;
  },
}));
jest.mock("../StatsSkeleton", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: () => <View testID="stats-skeleton" /> };
});

import { render, screen } from "@testing-library/react-native";
import { createNavigationMock } from "../../../screens/test-utils";
import Stats from "../Stats";
import { DashboardStat } from "../../../types";

const mockNavigation = createNavigationMock();

const DATA: DashboardStat = { seen: 42, observations: 100, diaries: 12, rank: 3, total: 500 };

const cardProps = (label: string) =>
  mockStatCardCapture.mock.calls.map((c) => c[0] as Record<string, unknown>).find((p) => p.label === label)!;

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows a skeleton while loading", async () => {
  await render(<Stats data={undefined} filters={{}} isLoading />);
  expect(screen.getByTestId("stats-skeleton")).toBeOnTheScreen();
  expect(mockStatCardCapture).not.toHaveBeenCalled();
});

it("renders nothing once done loading without data", async () => {
  await render(<Stats data={undefined} filters={{}} isLoading={false} />);
  expect(screen.queryByTestId("stats-skeleton")).not.toBeOnTheScreen();
  expect(mockStatCardCapture).not.toHaveBeenCalled();
});

it("renders a StatCard per metric once data is available", async () => {
  await render(<Stats data={DATA} filters={{}} isLoading={false} />);

  expect(cardProps("species").value).toBe(42);
  expect(cardProps("observations").value).toBe(100);
  expect(cardProps("diaries").value).toBe(12);
  expect(cardProps("rating").value).toBe("#3");
});

describe("navigation on tap", () => {
  it("species card navigates to Stat with the current filters + seenMode override", async () => {
    await render(<Stats data={DATA} filters={{ territory: 5 }} isLoading={false} />);
    (cardProps("species").onPress as () => void)();

    expect(mockNavigation.navigate).toHaveBeenCalledWith("Stat", {
      filtersOverride: { territory: 5 },
      seenMode: "seen",
    });
  });

  it("observations card navigates to Observations", async () => {
    await render(<Stats data={DATA} filters={{}} isLoading={false} />);
    (cardProps("observations").onPress as () => void)();
    expect(mockNavigation.navigate).toHaveBeenCalledWith("Observations");
  });

  it("diaries card navigates to Diaries", async () => {
    await render(<Stats data={DATA} filters={{}} isLoading={false} />);
    (cardProps("diaries").onPress as () => void)();
    expect(mockNavigation.navigate).toHaveBeenCalledWith("Diaries");
  });

  it("rating card navigates to Rating", async () => {
    await render(<Stats data={DATA} filters={{}} isLoading={false} />);
    (cardProps("rating").onPress as () => void)();
    expect(mockNavigation.navigate).toHaveBeenCalledWith("Rating");
  });
});
