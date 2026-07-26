jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("../../store/theme-context", () => ({
  useTheme: () => require("../mockTheme").mockUseTheme(),
}));
jest.mock("../../components/ui/Layout", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({ children }: { children: import("react").ReactNode }) => <View>{children}</View>,
  };
});
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));
jest.mock("../../hooks/useSyncedFilters", () => ({
  useSyncedFilters: jest.fn(),
}));
jest.mock("../../hooks/useDropdownQuery", () => ({
  useDropdownQuery: jest.fn(),
}));
// jest.config.js's setupFiles path only evaluates the async-storage mock
// without wiring it up as a replacement — WelcomeCard pulls in navigation
// helpers that touch it.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
  useQueryClient: () => mockQueryClient,
}));
jest.mock("../../util/fetches", () => ({
  fetchMyCountries: jest.fn(),
  fetchMyDashboardStat: jest.fn(),
}));
jest.mock("../../store/language-context", () => ({
  useLanguage: () => ({ language: "en" }),
}));
jest.mock("../../services/bottomSheet", () => ({
  BottomSheet: { showContent: jest.fn() },
}));
// FilterSheetContent is only ever passed as a renderContent callback to the
// mocked BottomSheet.showContent below, never actually mounted here.
jest.mock("../../components/Filters/FilterSheetContent", () => ({
  __esModule: true,
  default: () => null,
}));
// Every Main/* child is its own separately-testable widget with real
// queries of its own — MainScreen's job is only composing them with the
// right props, so each is stubbed to a labeled prop dump. Each factory
// below is self-contained (no shared helper referenced across factories):
// jest.mock() calls are hoisted above regular statements including a
// shared `const` helper would be, which breaks a call like
// `mockChild("Stats")` made eagerly inside another hoisted factory.
jest.mock("../../components/Main/FloatingNavbar", () => {
  const { TouchableOpacity, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ onPress, country }: { onPress: () => void; country?: { value: number } }) => (
      <TouchableOpacity testID="floating-navbar" onPress={onPress}>
        <Text>{`country:${country?.value ?? "none"}`}</Text>
      </TouchableOpacity>
    ),
  };
});
jest.mock("../../components/Main/Stats", () => {
  const { Text } = require("react-native");
  return { __esModule: true, default: (props: Record<string, unknown>) => <Text>{`Stats:${JSON.stringify(props)}`}</Text> };
});
jest.mock("../../components/Main/Sparkline", () => {
  const { Text } = require("react-native");
  return { __esModule: true, default: (props: Record<string, unknown>) => <Text>{`Sparkline:${JSON.stringify(props)}`}</Text> };
});
jest.mock("../../components/Main/BirdOfTheDay", () => {
  const { Text } = require("react-native");
  return { __esModule: true, default: (props: Record<string, unknown>) => <Text>{`BirdOfTheDay:${JSON.stringify(props)}`}</Text> };
});
jest.mock("../../components/Main/ChecklistHero", () => {
  const { Text } = require("react-native");
  return { __esModule: true, default: (props: Record<string, unknown>) => <Text>{`ChecklistHero:${JSON.stringify(props)}`}</Text> };
});
jest.mock("../../components/Main/RareNearby", () => {
  const { Text } = require("react-native");
  return { __esModule: true, default: (props: Record<string, unknown>) => <Text>{`RareNearby:${JSON.stringify(props)}`}</Text> };
});
jest.mock("../../components/Main/NewSpecies", () => {
  const { Text } = require("react-native");
  return { __esModule: true, default: (props: Record<string, unknown>) => <Text>{`NewSpecies:${JSON.stringify(props)}`}</Text> };
});
jest.mock("../../components/Main/QuickActions", () => {
  const { Text } = require("react-native");
  return { __esModule: true, default: (props: Record<string, unknown>) => <Text>{`QuickActions:${JSON.stringify(props)}`}</Text> };
});
jest.mock("../../components/Main/CatalogCard", () => {
  const { Text } = require("react-native");
  return { __esModule: true, default: () => <Text>CatalogCard</Text> };
});
jest.mock("../../components/Main/WelcomeCard", () => {
  const { Text } = require("react-native");
  return { __esModule: true, default: () => <Text>WelcomeCard</Text> };
});
jest.mock("../../components/Main/WidgetError", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => (
      <Text>{`WidgetError:${JSON.stringify(props)}`}</Text>
    ),
  };
});
jest.mock("../../components/Main/Sections", () => {
  const { Text } = require("react-native");
  return { __esModule: true, default: (props: Record<string, unknown>) => <Text>{`Sections:${JSON.stringify(props)}`}</Text> };
});

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useQuery } from "@tanstack/react-query";
import { useSyncedFilters } from "../../hooks/useSyncedFilters";
import { useDropdownQuery } from "../../hooks/useDropdownQuery";
import { fetchMyDashboardStat } from "../../util/fetches";
import { BottomSheet } from "../../services/bottomSheet";
import { createNavigationMock, createRouteMock } from "../test-utils";
import MainScreen from "../MainScreen";

const mockNavigation = createNavigationMock();
const mockQueryClient = { refetchQueries: jest.fn(async () => {}) };
const mockRoute = createRouteMock("Main", {});
const mockHandleClearFilters = jest.fn();
const mockHandleFiltersApplied = jest.fn();

const mockFilters = (overrides: Record<string, unknown> = {}) => {
  (useSyncedFilters as jest.Mock).mockReturnValue({
    filters: { territory: 5 },
    filtersLoaded: true,
    handleFiltersApplied: mockHandleFiltersApplied,
    handleClearFilters: mockHandleClearFilters,
    ...overrides,
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFilters();
  (useDropdownQuery as jest.Mock).mockReturnValue({
    query: { data: [{ value: 5, label: "France" }] },
  });
  (useQuery as jest.Mock).mockReturnValue({ data: { total: 10 }, isLoading: false });
});

it("drives useSyncedFilters with the Main screen's own fixed config", async () => {
  await render(<MainScreen />);
  const call = (useSyncedFilters as jest.Mock).mock.calls[0][0];
  expect(call.screenName).toBe("Main");
  expect(call.allowSort).toBe(false);
  expect(call.allowedFilters).toEqual(["territory", "date"]);
});

it("gates the countries dropdown query on filtersLoaded", async () => {
  mockFilters({ filtersLoaded: false });
  await render(<MainScreen />);
  const call = (useDropdownQuery as jest.Mock).mock.calls[0][0];
  expect(call.enabled).toBe(false);
});

it("resolves the matching country from the countries dropdown data and passes it to the navbar/hero", async () => {
  await render(<MainScreen />);
  expect(screen.getByText("country:5")).toBeOnTheScreen();
});

it("queries the dashboard stat with fetchMyDashboardStat(filters) and passes data/isLoading down", async () => {
  await render(<MainScreen />);
  const call = (useQuery as jest.Mock).mock.calls[0][0];
  expect(call.queryKey).toEqual(["DashboardStat", 5, null, null, null, null]);

  (fetchMyDashboardStat as jest.Mock).mockResolvedValueOnce({ total: 1 });
  await call.queryFn();
  expect(fetchMyDashboardStat).toHaveBeenCalledWith({ territory: 5 });

  expect(screen.getByText(/^Stats:.*"data":\{"total":10\}/)).toBeOnTheScreen();
});

it("tapping the navbar opens the filter sheet wired to handleClearFilters", async () => {
  await render(<MainScreen />);
  await fireEvent.press(screen.getByTestId("floating-navbar"));

  expect(BottomSheet.showContent).toHaveBeenCalledWith(
    expect.objectContaining({ title: "filters", onReset: mockHandleClearFilters }),
  );
});

// The dashboard scroll view has no testID; walk up from a widget inside it.
// Re-read it after every state change — the props are a render-time snapshot.
const scrollView = () => {
  let node = screen.getByText(/^Sparkline:/).parent;
  while (node && node.type !== "RCTScrollView") node = node.parent;
  return node!;
};

it("pull to refresh refetches every widget the dashboard has mounted", async () => {
  // The dashboard is a dozen independent queries; refetching the active ones
  // beats threading a refetch through each widget.
  await render(<MainScreen />);

  // onRefresh flips the spinner state around the refetch, so it needs act().
  await act(async () => {
    await scrollView().props.refreshControl.props.onRefresh();
  });

  expect(mockQueryClient.refetchQueries).toHaveBeenCalledWith({
    type: "active",
  });
});

it("reserves the navbar's strip as padding, never as a native contentInset", async () => {
  // iOS' contentInset was how the pull-to-refresh spinner used to be kept
  // below the navbar, but Fabric zeroes a recycled scroll view's inset and
  // re-applies props only on a diff — so after a few screens the strip
  // vanished and the stat tiles were stuck under the navbar, unreachable by
  // scrolling. Padding cannot be lost that way; the spinner is placed with
  // progressViewOffset instead.
  // (jest-expo runs as iOS; insets are mocked to 0, so NAVBAR_HEIGHT is 60.)
  await render(<MainScreen />);

  const props = scrollView().props;
  expect(props.contentContainerStyle.paddingTop).toBe(68);
  expect(props.contentInset).toBeUndefined();
  expect(props.contentOffset).toBeUndefined();
  expect(props.refreshControl.props.progressViewOffset).toBe(80);
});

it("drops the spinner on a refetch that never settles", async () => {
  // Offline, react-query pauses the refetches and refetchQueries' promise
  // stays pending until the network is back — the spinner used to hang there.
  jest.useFakeTimers();
  try {
    mockQueryClient.refetchQueries.mockReturnValueOnce(
      new Promise<void>(() => {}),
    );
    await render(<MainScreen />);

    await act(async () => {
      scrollView().props.refreshControl.props.onRefresh();
    });
    expect(scrollView().props.refreshControl.props.refreshing).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(60000);
    });
    expect(scrollView().props.refreshControl.props.refreshing).toBe(false);
  } finally {
    jest.useRealTimers();
  }
});

it("puts logging a sighting above the content blocks", async () => {
  // The quick actions used to sit seventh of eight, below every widget.
  await render(<MainScreen />);

  const order = screen
    .getAllByText(/^(Stats:|QuickActions|Sparkline:|Sections)/)
    .map((node) => String(node.props.children).split(":")[0]);

  expect(order.indexOf("QuickActions")).toBeLessThan(
    order.indexOf("Sparkline"),
  );
  expect(order.indexOf("Stats")).toBeLessThan(order.indexOf("QuickActions"));
});

it("offers a retry instead of dropping the stats when their query fails", async () => {
  (useQuery as jest.Mock).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: true,
    refetch: jest.fn(),
  });

  await render(<MainScreen />);

  expect(screen.getByText(/^WidgetError:/)).toBeOnTheScreen();
  expect(screen.queryByText(/^Stats:/)).toBeNull();
});

it("keeps showing the stats it has when a background refetch fails", async () => {
  (useQuery as jest.Mock).mockReturnValue({
    data: { total: 10, observations: 3, diaries: 1 },
    isLoading: false,
    isError: true,
    refetch: jest.fn(),
  });

  await render(<MainScreen />);

  expect(screen.getByText(/^Stats:/)).toBeOnTheScreen();
  expect(screen.queryByText(/^WidgetError:/)).toBeNull();
});

it("welcomes an account that has logged nothing yet", async () => {
  (useQuery as jest.Mock).mockReturnValue({
    data: { total: 10, observations: 0, diaries: 0 },
    isLoading: false,
  });

  await render(<MainScreen />);

  expect(screen.getByText("WelcomeCard")).toBeOnTheScreen();
});

it("drops the welcome card as soon as there is anything to show", async () => {
  (useQuery as jest.Mock).mockReturnValue({
    data: { total: 10, observations: 1, diaries: 0 },
    isLoading: false,
  });

  await render(<MainScreen />);

  expect(screen.queryByText("WelcomeCard")).toBeNull();
});
