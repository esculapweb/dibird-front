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
jest.mock("../SparklineSkeleton", () => {
  const { View } = require("react-native");
  return { SparklineSkeleton: () => <View testID="sparkline-skeleton" /> };
});
jest.mock("../../../util/fetches", () => ({ fetchMyActivity: jest.fn() }));

import { QueryClient, QueryClientProvider, notifyManager } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

notifyManager.setScheduler((callback) => callback());

import { fetchMyActivity } from "../../../util/fetches";
import Sparkline from "../Sparkline";
import { ActivityResponse, Filters } from "../../../types";

let queryClient: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const ACTIVITY = (overrides: Partial<ActivityResponse> = {}): ActivityResponse => ({
  data: [1, 2, 3, 4, 5],
  meta: {
    group: "day",
    from: "2026-01-01",
    to: "2026-01-05",
    points: 5,
    total: 15,
    delta: 3,
    delta_label: "+3",
    recent_threshold: 3,
    recent_window: 7,
    period_label_key: "this_week",
    delta_label_key: "this_week",
    label_params: { year: 2026 },
  } as ActivityResponse["meta"],
  ...overrides,
});

const renderWithClient = async (filters: Filters, chartType?: "bar" | "dot") =>
  render(<Sparkline filters={filters} chartType={chartType} />, { wrapper });

beforeEach(() => {
  jest.clearAllMocks();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  (fetchMyActivity as jest.Mock).mockResolvedValue(ACTIVITY());
});

afterEach(() => {
  queryClient.clear();
});

it("shows a skeleton while loading", async () => {
  let resolveFetch!: (v: ActivityResponse) => void;
  (fetchMyActivity as jest.Mock).mockReturnValue(
    new Promise((resolve) => {
      resolveFetch = resolve;
    }),
  );
  const { findByText } = await renderWithClient({});
  expect(screen.getByTestId("sparkline-skeleton")).toBeOnTheScreen();

  resolveFetch(ACTIVITY());
  await findByText("new_species");
  expect(screen.queryByTestId("sparkline-skeleton")).not.toBeOnTheScreen();
});

it("renders nothing once loaded with an empty data array", async () => {
  (fetchMyActivity as jest.Mock).mockResolvedValue(ACTIVITY({ data: [] }));
  await renderWithClient({});
  expect(screen.queryByTestId("sparkline-skeleton")).not.toBeOnTheScreen();
  expect(screen.queryByText("new_species")).not.toBeOnTheScreen();
});

it("renders nothing when every data point is zero", async () => {
  (fetchMyActivity as jest.Mock).mockResolvedValue(ACTIVITY({ data: [0, 0, 0] }));
  await renderWithClient({});
  expect(screen.queryByText("new_species")).not.toBeOnTheScreen();
});

it("queries with new:true for the default 'newSpecies' mode", async () => {
  await renderWithClient({ territory: 5 });
  expect(fetchMyActivity).toHaveBeenCalledWith({ territory: 5, new: true });
});

describe("delta label", () => {
  it("shows the delta label when meta.delta is non-zero", async () => {
    await renderWithClient({});
    expect(screen.getByText("+3", { exact: false })).toBeOnTheScreen();
  });

  it("hides the delta label when meta.delta is 0", async () => {
    (fetchMyActivity as jest.Mock).mockResolvedValue(ACTIVITY({ meta: { ...ACTIVITY().meta, delta: 0 } }));
    await renderWithClient({});
    expect(screen.queryByText("+3", { exact: false })).not.toBeOnTheScreen();
  });
});

describe("mode dropdown", () => {
  it("starts closed, showing 'new_species' as the current mode", async () => {
    await renderWithClient({});
    expect(screen.getByText("new_species")).toBeOnTheScreen();
    expect(screen.queryByText("observations")).not.toBeOnTheScreen();
  });

  it("opens to reveal both mode options", async () => {
    await renderWithClient({});
    await fireEvent.press(screen.getByText("chevron-down"));
    expect(screen.getByText("observations")).toBeOnTheScreen();
  });

  it("switching to 'observations' re-queries without new:true, and closes the menu", async () => {
    await renderWithClient({ territory: 5 });
    await fireEvent.press(screen.getByText("chevron-down"));

    await act(async () => {
      fireEvent.press(screen.getByText("observations"));
    });

    expect(fetchMyActivity).toHaveBeenLastCalledWith({ territory: 5 });
    expect(screen.queryByText("new_species")).not.toBeOnTheScreen();
  });
});

it("does not throw with chartType='dot'", async () => {
  await renderWithClient({}, "dot");
  expect(screen.getByText("new_species")).toBeOnTheScreen();
});
