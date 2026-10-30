jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { count?: number; n?: number }) =>
      opts?.count !== undefined
        ? `${key}:${opts.count}`
        : opts?.n !== undefined
          ? `${key}:${opts.n}`
          : key,
    i18n: { language: "en" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../store/theme-context", () => ({
  useTheme: () => require("../mockTheme").mockUseTheme(),
}));
jest.mock("../../hooks/useContentWidth", () => ({ useContentWidth: () => 400 }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("../../components/ui/Layout", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({ children }: { children: import("react").ReactNode }) => <View>{children}</View>,
  };
});
// The chart is plain SVG drawing; what matters here is what the screen does
// with a selected column, so the stub exposes one press target per column.
jest.mock("../../components/Activity/ActivityChart", () => {
  const { Pressable, View } = require("react-native");
  return {
    __esModule: true,
    default: ({ data, onSelect }: { data: number[]; onSelect: (i: number) => void }) => (
      <View testID="activity-chart">
        {data.map((_v, i) => (
          <Pressable key={i} testID={`bar-${i}`} onPress={() => onSelect(i)} />
        ))}
      </View>
    ),
  };
});
jest.mock("../../util/fetches", () => ({ fetchMyActivity: jest.fn() }));
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));

import { QueryClient, QueryClientProvider, notifyManager } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

notifyManager.setScheduler((callback) => callback());

import ActivityScreen from "../ActivityScreen";
import { fetchMyActivity } from "../../util/fetches";
import { ActivityResponse } from "../../types";
import { createNavigationMock, createRouteMock } from "../test-utils";

const mockNavigation = createNavigationMock();
let mockRoute: ReturnType<typeof createRouteMock>;

let queryClient: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const RESPONSE = (overrides: Partial<ActivityResponse> = {}): ActivityResponse => ({
  data: [2, 0, 5],
  periods: ["2026-05-13", "2026-05-18", "2026-05-25"],
  meta: {
    group: "week",
    from: "2026-05-13",
    to: "2026-05-26",
    points: 3,
    total: 7,
    delta: 3,
    delta_label: "+3",
    recent_threshold: 2,
    recent_window: 1,
    period_label_key: "activity_month_range",
    delta_label_key: "this_month",
    label_params: { year: 2026 },
  },
  ...overrides,
});

const renderScreen = async (mode: "newSpecies" | "observations" = "observations") => {
  mockRoute = createRouteMock("Activity", { filters: { territory: 5 }, mode });
  await render(<ActivityScreen />, { wrapper });
  await screen.findByTestId("activity-total");
};

beforeEach(() => {
  jest.clearAllMocks();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  (fetchMyActivity as jest.Mock).mockResolvedValue(RESPONSE());
});

afterEach(() => {
  queryClient.clear();
});

it("shows the total and the delta from the response", async () => {
  await renderScreen();
  expect(screen.getByTestId("activity-total")).toHaveTextContent("7");
  expect(screen.getByTestId("activity-delta")).toHaveTextContent("+3");
});

it("queries with the route's mode", async () => {
  await renderScreen("newSpecies");
  expect(fetchMyActivity).toHaveBeenCalledWith({ territory: 5, new: true });
});

it("selects the latest column by default", async () => {
  await renderScreen();
  expect(screen.getByTestId("activity-selected")).toHaveTextContent(
    "activity_observations_count:5",
    { exact: false },
  );
});

it("opens the selected column's dates in the observations list", async () => {
  await renderScreen();
  await fireEvent.press(screen.getByTestId("bar-0"));
  await fireEvent.press(screen.getByTestId("activity-selected"));

  expect(mockNavigation.navigate).toHaveBeenCalledWith("Observations", {
    filtersOverride: {
      territory: 5,
      place: null,
      species: null,
      date: { type: "range", from: "2026-05-13", to: "2026-05-17" },
    },
  });
});

it("opens the species list in the new-species mode", async () => {
  await renderScreen("newSpecies");
  await fireEvent.press(screen.getByTestId("activity-top-0"));

  // The period stays the chart's own (none here), first_seen narrows the
  // list down to the column — so the list matches the number on it.
  expect(mockNavigation.navigate).toHaveBeenCalledWith("Stat", {
    filtersOverride: {
      territory: 5,
      place: null,
      species: null,
      date: null,
      first_seen: { from: "2026-05-25", to: "2026-05-26" },
    },
    seenMode: "seen",
    o: "-seen,-date_time",
  });
});

it("lists the busiest columns, skipping empty ones", async () => {
  await renderScreen();
  expect(screen.getByTestId("activity-top-0")).toHaveTextContent("5", { exact: false });
  expect(screen.getByTestId("activity-top-1")).toHaveTextContent("2", { exact: false });
  expect(screen.queryByTestId("activity-top-2")).not.toBeOnTheScreen();
});

it("switching the mode refetches", async () => {
  await renderScreen();
  await act(async () => {
    fireEvent.press(screen.getByTestId("activity-mode-newSpecies"));
  });
  expect(fetchMyActivity).toHaveBeenLastCalledWith({ territory: 5, new: true });
});

it("draws the chart but offers nothing to open without period starts", async () => {
  // An offline cache entry written before the backend sent `periods`.
  (fetchMyActivity as jest.Mock).mockResolvedValue(RESPONSE({ periods: undefined }));
  await renderScreen();

  expect(screen.getByTestId("activity-chart")).toBeOnTheScreen();
  expect(screen.queryByTestId("activity-selected")).not.toBeOnTheScreen();
  expect(screen.queryByTestId("activity-top-0")).not.toBeOnTheScreen();
});

it("says so when the period is empty", async () => {
  (fetchMyActivity as jest.Mock).mockResolvedValue(RESPONSE({ data: [0, 0, 0] }));
  mockRoute = createRouteMock("Activity", { filters: {}, mode: "observations" });
  await render(<ActivityScreen />, { wrapper });

  expect(await screen.findByTestId("activity-empty")).toBeOnTheScreen();
});

it("labels the delta with the compared window", async () => {
  (fetchMyActivity as jest.Mock).mockResolvedValue(
    RESPONSE({ meta: { ...RESPONSE().meta, delta_window: { unit: "days", n: 30 } } }),
  );
  await renderScreen();
  expect(screen.getByText("activity_delta_days:30")).toBeOnTheScreen();
});

it("hides the delta when there is nothing to compare", async () => {
  (fetchMyActivity as jest.Mock).mockResolvedValue(
    RESPONSE({ meta: { ...RESPONSE().meta, delta_window: null } }),
  );
  await renderScreen();
  expect(screen.queryByTestId("activity-delta")).not.toBeOnTheScreen();
});
