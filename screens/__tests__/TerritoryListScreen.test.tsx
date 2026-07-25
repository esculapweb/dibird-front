jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../store/theme-context", () => ({
  useTheme: () => require("../mockTheme").mockUseTheme(),
}));
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));
jest.mock("../../components/ui/Layout", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({ children }: { children: import("react").ReactNode }) => (
      <View>{children}</View>
    ),
  };
});
jest.mock("../../hooks/useList", () => ({ useList: jest.fn() }));
jest.mock("../../hooks/useDebounce", () => ({
  useDebounce: (value: string) => value,
}));
jest.mock("../../hooks/useScreenSort", () => ({
  useScreenSort: (...args: unknown[]) => {
    mockScreenSortArgs = args;
    return { sort: "name", openSortSheet: mockOpenSortSheet };
  },
}));
jest.mock("../../util/fetches", () => ({
  fetchTerritoryList: jest.fn(() => jest.fn()),
}));
jest.mock("../../util/navigationCallbacks", () => ({
  callNavigationCallback: jest.fn(),
}));
jest.mock("../../components/ui/ItemsList", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      mockItemsListProps = props;
      // Rows go through the captured renderItem (see renderRow) — a jest.mock
      // factory can't reference anything from module scope.
      return <View testID="items-list">{props.listHeader as never}</View>;
    },
  };
});
jest.mock("../../components/ui/SearchInput", () => {
  const { TextInput } = require("react-native");
  return {
    __esModule: true,
    default: ({
      value,
      onChange,
      placeholder,
      autoFocus,
    }: {
      value: string;
      onChange: (next: string) => void;
      placeholder?: string;
      autoFocus?: boolean;
    }) => (
      <TextInput
        testID="search-input"
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChangeText={onChange}
      />
    ),
  };
});
jest.mock("../../components/Territory/RegionFilterChips", () => {
  const { Pressable, Text, View } = require("react-native");
  return {
    __esModule: true,
    default: ({
      value,
      onChange,
    }: {
      value: number | null;
      onChange: (next: number | null) => void;
    }) => (
      <View testID="region-chips">
        <Text testID="region-active">{String(value)}</Text>
        <Pressable testID="pick-region" onPress={() => onChange(15)}>
          <Text>South America</Text>
        </Pressable>
      </View>
    ),
  };
});
jest.mock("../../components/Territory/TerritoryRow", () => {
  const { Pressable, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({
      name,
      speciesLabel,
      onPress,
    }: {
      name: string;
      speciesLabel?: string | null;
      onPress: () => void;
    }) => (
      <Pressable onPress={onPress}>
        <Text>{name}</Text>
        {!!speciesLabel && <Text>{speciesLabel}</Text>}
      </Pressable>
    ),
  };
});

import { ReactElement } from "react";
import { Share } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { createNavigationMock, createRouteMock } from "../test-utils";
import TerritoryListScreen from "../TerritoryListScreen";
import { useList } from "../../hooks/useList";
import { fetchTerritoryList } from "../../util/fetches";
import { callNavigationCallback } from "../../util/navigationCallbacks";
import { TerritoryListItem } from "../../types";

let mockRoute: ReturnType<typeof createRouteMock>;
let mockItemsListProps: Record<string, unknown>;
let mockScreenSortArgs: unknown[];
const mockOpenSortSheet = jest.fn();
const mockNavigation = createNavigationMock();
const mockUseList = useList as jest.Mock;
const mockFetchTerritoryList = fetchTerritoryList as jest.Mock;
const mockCallNavigationCallback = callNavigationCallback as jest.Mock;

const COUNTRIES: TerritoryListItem[] = [
  {
    name: "Argentina",
    segment: "argentina",
    code: "AR",
    short: "<p>South America</p>",
    count: { "2": "27 orders", "5": "1111 species" },
  },
  {
    name: "Austria",
    segment: "austria",
    code: "AT",
    short: null,
    count: { "5": "254 species" },
  },
];

const listResult = (overrides: Record<string, unknown> = {}) => ({
  data: { pages: [{ results: COUNTRIES, pagination: { count: 249 } }] },
  fetchNextPage: jest.fn(),
  hasNextPage: false,
  isFetchingNextPage: false,
  isLoading: false,
  isError: false,
  isRefetching: false,
  error: null,
  refetch: jest.fn(),
  ...overrides,
});

const listOptions = () => mockUseList.mock.calls.at(-1)![0];

// The IconsHeader props the screen hands to setOptions, read straight off the
// headerRight element without mounting it.
const headerProps = (): Record<string, unknown> => {
  const options = (mockNavigation.setOptions as jest.Mock).mock.calls.at(-1)![0];
  return options.headerRight().props;
};

const sharedUrl = (spy: jest.SpyInstance) => {
  const arg = spy.mock.calls[0][0] as { url?: string; message?: string };
  return arg.url ?? arg.message ?? "";
};

const renderRow = (item: TerritoryListItem) =>
  render(
    (
      mockItemsListProps.renderItem as (arg: {
        item: TerritoryListItem;
      }) => ReactElement
    )({ item }),
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockRoute = createRouteMock("TerritoryList", undefined);
  mockUseList.mockReturnValue(listResult());
});

it("lists the countries with their species counts", async () => {
  await render(<TerritoryListScreen />);
  await renderRow(COUNTRIES[0]);

  expect(mockItemsListProps.data).toEqual(COUNTRIES);
  expect(screen.getByText("Argentina")).toBeOnTheScreen();
  // The API sends localized, number-agreed labels per rank; the row shows the
  // species one, not the order/family counts.
  expect(screen.getByText("1111 species")).toBeOnTheScreen();
  expect(screen.queryByText("27 orders")).toBeNull();
});

it("keys the rows by segment", async () => {
  await render(<TerritoryListScreen />);

  expect(
    (mockItemsListProps.keyExtractor as (item: TerritoryListItem) => string)(
      COUNTRIES[0],
    ),
  ).toBe("argentina");
});

it("opens the country page from a row", async () => {
  await render(<TerritoryListScreen />);
  await renderRow(COUNTRIES[1]);
  await fireEvent.press(screen.getByText("Austria"));

  expect(mockNavigation.navigate).toHaveBeenCalledWith("TerritoryDetail", {
    segment: "austria",
  });
});

it("hands the country to the picker and pops back instead of opening it", async () => {
  mockRoute = createRouteMock("TerritoryList", {
    pickerKey: "territory-compare-0",
  });

  await render(<TerritoryListScreen />);
  await renderRow(COUNTRIES[1]);
  await fireEvent.press(screen.getByText("Austria"));

  expect(mockCallNavigationCallback).toHaveBeenCalledWith(
    "territory-compare-0",
    COUNTRIES[1],
  );
  expect(mockNavigation.goBack).toHaveBeenCalled();
  expect(mockNavigation.navigate).not.toHaveBeenCalled();
});

it("keeps the compare shortcut out of the picker, where it would be a dead end", async () => {
  mockRoute = createRouteMock("TerritoryList", { pickerKey: "k" });

  await render(<TerritoryListScreen />);

  expect(screen.queryByTestId("compare-territories-shortcut")).toBeNull();
});

it("opens the comparison from the shortcut", async () => {
  await render(<TerritoryListScreen />);
  await fireEvent.press(screen.getByTestId("compare-territories-shortcut"));

  expect(mockNavigation.navigate).toHaveBeenCalledWith(
    "TerritoryCompare",
    undefined,
  );
});

it("leaves the keyboard down in picker mode — the list is browsable as is", async () => {
  mockRoute = createRouteMock("TerritoryList", { pickerKey: "k" });

  await render(<TerritoryListScreen />);

  expect(screen.getByTestId("search-input").props.autoFocus).toBeFalsy();
});

it("searches by name through the list query", async () => {
  await render(<TerritoryListScreen />);

  await fireEvent.changeText(screen.getByTestId("search-input"), "arg");

  expect(listOptions().search).toBe("arg");
});

it("takes its sort from the countries preference, seeded by a shared link", async () => {
  mockRoute = createRouteMock("TerritoryList", { initialSort: "-species_count" });

  await render(<TerritoryListScreen />);

  expect(mockScreenSortArgs).toEqual(["Territory", "-species_count"]);
  expect(listOptions().sort).toBe("name");
});

it("seeds the search box from a shared link", async () => {
  mockRoute = createRouteMock("TerritoryList", { initialSearch: "austr" });

  await render(<TerritoryListScreen />);

  expect(screen.getByTestId("search-input").props.value).toBe("austr");
});

it("asks for the next page when the list runs out", async () => {
  const result = listResult({ hasNextPage: true });
  mockUseList.mockReturnValue(result);

  await render(<TerritoryListScreen />);
  (mockItemsListProps.onEndReached as () => void)();

  expect(result.fetchNextPage).toHaveBeenCalled();
});

it("refetches on pull-to-refresh", async () => {
  // The list is cached for a day and survives restarts, so this is the only
  // way to see a backend change before then.
  const result = listResult();
  mockUseList.mockReturnValue(result);

  await render(<TerritoryListScreen />);
  (mockItemsListProps.onRefresh as () => void)();

  expect(result.refetch).toHaveBeenCalled();
});

it("holds the list back until the first page is in", async () => {
  mockUseList.mockReturnValue(listResult({ isLoading: true, data: undefined }));

  await render(<TerritoryListScreen />);

  expect(screen.queryByTestId("items-list")).toBeNull();
});

it("offers a retry when the first page could not be loaded", async () => {
  const result = listResult({
    data: undefined,
    isError: true,
    error: new Error("Network Error"),
  });
  mockUseList.mockReturnValue(result);

  await render(<TerritoryListScreen />);
  expect(screen.getByText("countries_unavailable")).toBeOnTheScreen();

  await fireEvent.press(screen.getByText("try_again"));
  expect(result.refetch).toHaveBeenCalled();
});

it("keeps showing the cached page when a refetch fails", async () => {
  // Offline with a persisted cache: an error next to data is not a dead end.
  mockUseList.mockReturnValue(
    listResult({ isError: true, error: new Error("Network Error") }),
  );

  await render(<TerritoryListScreen />);

  expect(screen.queryByText("countries_unavailable")).toBeNull();
  expect(mockItemsListProps.data).toEqual(COUNTRIES);
});

it("shares the list at the site's own path, carrying the current order", async () => {
  const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({
    action: "sharedAction",
  } as never);

  await render(<TerritoryListScreen />);
  await (headerProps().onSharePress as () => Promise<void>)();

  expect(sharedUrl(shareSpy)).toContain("/territory/?o=name");
});

it("offers no share action while picking a country", async () => {
  // The picker is a sub-screen of the comparison; the site has no URL for it.
  mockRoute = createRouteMock("TerritoryList", { pickerKey: "k" });

  await render(<TerritoryListScreen />);

  expect(headerProps().onSharePress).toBeUndefined();
});

it("opens the sort sheet from the header", async () => {
  await render(<TerritoryListScreen />);
  (headerProps().onSortPress as () => void)();

  expect(mockOpenSortSheet).toHaveBeenCalled();
});

it("filters the list by region and puts it in the query key", async () => {
  await render(<TerritoryListScreen />);
  expect(listOptions().screenName).toBe("TerritoryList-all");

  await fireEvent.press(screen.getByTestId("pick-region"));

  expect(mockFetchTerritoryList).toHaveBeenLastCalledWith(15);
  // useList builds its key from screenName/filters/sort/search only — the
  // region lives inside the fetch closure, invisible to it.
  expect(listOptions().screenName).toBe("TerritoryList-15");
});

it("seeds the region from a shared link", async () => {
  mockRoute = createRouteMock("TerritoryList", { initialRegion: 15 });

  await render(<TerritoryListScreen />);

  expect(screen.getByTestId("region-active")).toHaveTextContent("15");
  expect(mockFetchTerritoryList).toHaveBeenLastCalledWith(15);
});

it("offers to clear the region, not just the search, when nothing matches", async () => {
  await render(<TerritoryListScreen />);
  await fireEvent.press(screen.getByTestId("pick-region"));

  expect(mockItemsListProps.emptyType).toBe("filtered");
  await act(async () => (mockItemsListProps.onClear as () => void)());

  expect(screen.getByTestId("region-active")).toHaveTextContent("null");
});

it("carries the region and the order into the shared link", async () => {
  const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({
    action: "sharedAction",
  } as never);

  await render(<TerritoryListScreen />);
  await fireEvent.press(screen.getByTestId("pick-region"));
  await (headerProps().onSharePress as () => Promise<void>)();

  expect(sharedUrl(shareSpy)).toContain("/territory/?region=15&o=name");
});
