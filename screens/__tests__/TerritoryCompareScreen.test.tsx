jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../store/theme-context", () => ({
  useTheme: () => require("../mockTheme").mockUseTheme(),
}));
jest.mock("../../store/language-context", () => ({
  useLanguage: () => ({ language: "en" }),
}));
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));
jest.mock("../../util/fetches", () => ({ fetchTerritoryCompare: jest.fn() }));
jest.mock("../../hooks/useScreenSort", () => ({
  useScreenSort: (...args: unknown[]) => {
    mockScreenSortArgs = args;
    return { sort: mockSort, openSortSheet: mockOpenSortSheet };
  },
}));
jest.mock("../../components/ui/Layout", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({
      children,
      bottom,
    }: {
      children: import("react").ReactNode;
      bottom?: import("react").ReactNode;
    }) => (
      <View>
        {children}
        {bottom}
      </View>
    ),
  };
});
jest.mock("../../components/ui/IconsHeader", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: () => <View testID="icons-header" /> };
});
jest.mock("../../components/ui/Tabs", () => {
  const { Pressable, Text, View } = require("react-native");
  return {
    __esModule: true,
    default: ({
      tabOptions,
      setTabsMode,
    }: {
      tabOptions: { value: string; count?: number; labelKey: string }[];
      setTabsMode: (value: string) => void;
    }) => (
      <View testID="tabs">
        {tabOptions.map((tab) => (
          <Pressable
            key={tab.value}
            testID={`tab-${tab.value}`}
            onPress={() => setTabsMode(tab.value)}
          >
            <Text>{`${tab.value}:${tab.count ?? "-"}`}</Text>
            <Text testID={`tab-label-${tab.value}`}>{tab.labelKey}</Text>
          </Pressable>
        ))}
      </View>
    ),
  };
});
jest.mock("../../components/ui/ItemsList", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      mockItemsListProps = props;
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
    }: {
      value: string;
      onChange: (next: string) => void;
    }) => (
      <TextInput testID="search-input" value={value} onChangeText={onChange} />
    ),
  };
});
jest.mock("../../components/Territory/TerritoryCompareRow", () => {
  const { Pressable, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({
      item,
      onPress,
    }: {
      item: { name_lang: string };
      onPress: () => void;
    }) => (
      <Pressable onPress={onPress}>
        <Text>{item.name_lang}</Text>
      </Pressable>
    ),
  };
});

import { ReactElement } from "react";
import { Share } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useQuery } from "@tanstack/react-query";
import { createNavigationMock, createRouteMock } from "../test-utils";
import TerritoryCompareScreen from "../TerritoryCompareScreen";
import { callNavigationCallback } from "../../util/navigationCallbacks";
import { TerritoryCompareResponse, TerritoryCompareSpecies } from "../../types";

let mockRoute: ReturnType<typeof createRouteMock>;
let mockItemsListProps: Record<string, unknown>;
let mockScreenSortArgs: unknown[];
let mockSort = "ioc_id";
const mockOpenSortSheet = jest.fn();
const mockNavigation = createNavigationMock();
const mockUseQuery = useQuery as jest.Mock;

const SPECIES: TerritoryCompareSpecies[] = [
  {
    name: "Greater Rhea / Rhea americana",
    name_lang: "Greater Rhea",
    segment: "greater-rhea",
    status: "NT",
    in_object: [true, false],
  },
  {
    name: "Lesser Rhea / Rhea pennata",
    name_lang: "Lesser Rhea",
    segment: "lesser-rhea",
    status: "LC",
    in_object: [true, true],
  },
  {
    name: "Andean Condor / Vultur gryphus",
    name_lang: "Andean Condor",
    segment: "andean-condor",
    status: "VU",
    in_object: [false, true],
  },
];

const RESPONSE: TerritoryCompareResponse = {
  all_count: 3,
  common_count: 1,
  different_count: 2,
  territory_data: [
    { name: "Argentina", segment: "argentina", code: "AR" },
    { name: "Chile", segment: "chile", code: "CL" },
  ],
  territory_all_count: [2, 2],
  territory_diff_count: [1, 1],
  species_data: SPECIES,
};

const queryResult = (overrides: Record<string, unknown> = {}) => ({
  data: RESPONSE,
  isLoading: false,
  isError: false,
  isRefetching: false,
  refetch: jest.fn(),
  ...overrides,
});

const rows = () => mockItemsListProps.data as TerritoryCompareSpecies[];

const renderRow = (item: TerritoryCompareSpecies) =>
  render(
    (
      mockItemsListProps.renderItem as (arg: {
        item: TerritoryCompareSpecies;
      }) => ReactElement
    )({ item }),
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockSort = "ioc_id";
  mockRoute = createRouteMock("TerritoryCompare", {
    segment1: "argentina",
    segment2: "chile",
  });
  mockUseQuery.mockReturnValue(queryResult());
});

it("shows both countries with their flags and species totals", async () => {
  await render(<TerritoryCompareScreen />);

  expect(screen.getByText("Argentina")).toBeOnTheScreen();
  expect(screen.getByText("Chile")).toBeOnTheScreen();
  expect(screen.getByText("🇦🇷")).toBeOnTheScreen();
  expect(screen.getAllByText("2")).toHaveLength(2);
});

it("lists every species of either country on the All tab", async () => {
  await render(<TerritoryCompareScreen />);

  expect(rows().map((s) => s.segment)).toEqual([
    "greater-rhea",
    "lesser-rhea",
    "andean-condor",
  ]);
});

it("keeps only the shared species on the Common tab", async () => {
  await render(<TerritoryCompareScreen />);

  await fireEvent.press(screen.getByTestId("tab-common"));

  expect(rows().map((s) => s.segment)).toEqual(["lesser-rhea"]);
});

it("keeps only the species one country lacks on the Different tab", async () => {
  await render(<TerritoryCompareScreen />);

  await fireEvent.press(screen.getByTestId("tab-different"));

  expect(rows().map((s) => s.segment)).toEqual([
    "greater-rhea",
    "andean-condor",
  ]);
});

it("puts the server's counts on the tabs", async () => {
  await render(<TerritoryCompareScreen />);

  expect(screen.getByText("all:3")).toBeOnTheScreen();
  expect(screen.getByText("common:1")).toBeOnTheScreen();
  expect(screen.getByText("different:2")).toBeOnTheScreen();
});

it("labels the tabs about countries, not about users", async () => {
  // Russian agrees with the subject: the users' comparison says "у обоих",
  // two countries need "в обеих" — so these are keys of their own.
  await render(<TerritoryCompareScreen />);

  expect(screen.getByTestId("tab-label-common")).toHaveTextContent(
    "in_both_territories",
  );
  expect(screen.getByTestId("tab-label-different")).toHaveTextContent(
    "in_one_territory_only",
  );
  expect(screen.getByTestId("tab-label-all")).toHaveTextContent("all");
});

it("keeps its own sort preference, not the species catalogue's", async () => {
  await render(<TerritoryCompareScreen />);

  expect(mockScreenSortArgs[0]).toBe("TerritoryCompare");
});

it("sorts alphabetically in the app — the whole list is already here", async () => {
  mockSort = "name";
  await render(<TerritoryCompareScreen />);

  expect(rows().map((s) => s.name_lang)).toEqual([
    "Andean Condor",
    "Greater Rhea",
    "Lesser Rhea",
  ]);
});

it("reverses the alphabet on the descending option", async () => {
  mockSort = "-name";
  await render(<TerritoryCompareScreen />);

  expect(rows().map((s) => s.name_lang)).toEqual([
    "Lesser Rhea",
    "Greater Rhea",
    "Andean Condor",
  ]);
});

it("takes the server's order as the taxonomic one", async () => {
  // The rows carry no ioc id — the API sends them ordered by it, so
  // "taxonomic" is the order they arrived in, and its reverse.
  mockSort = "-ioc_id";
  await render(<TerritoryCompareScreen />);

  expect(rows().map((s) => s.segment)).toEqual([
    "andean-condor",
    "lesser-rhea",
    "greater-rhea",
  ]);
});

it("sorts what the tab and the search left, not the whole response", async () => {
  mockSort = "name";
  await render(<TerritoryCompareScreen />);

  await fireEvent.press(screen.getByTestId("tab-different"));

  expect(rows().map((s) => s.name_lang)).toEqual([
    "Andean Condor",
    "Greater Rhea",
  ]);
});

it("offers no sort until there is something to compare", async () => {
  mockRoute = createRouteMock("TerritoryCompare", { segment1: "argentina" });
  mockUseQuery.mockReturnValue(queryResult({ data: undefined }));

  await render(<TerritoryCompareScreen />);
  expect(headerProps().onSortPress).toBeUndefined();
});

it("filters locally by name, on top of the active tab", async () => {
  // The whole list arrives in one response, so search never hits the network.
  await render(<TerritoryCompareScreen />);

  await fireEvent.changeText(screen.getByTestId("search-input"), "condor");

  expect(rows().map((s) => s.segment)).toEqual(["andean-condor"]);
});

it("matches the latin name too", async () => {
  await render(<TerritoryCompareScreen />);

  await fireEvent.changeText(screen.getByTestId("search-input"), "vultur");

  expect(rows().map((s) => s.segment)).toEqual(["andean-condor"]);
});

it("opens the species page from a row", async () => {
  await render(<TerritoryCompareScreen />);
  await renderRow(SPECIES[0]);
  await fireEvent.press(screen.getByText("Greater Rhea"));

  expect(mockNavigation.navigate).toHaveBeenCalledWith("SpeciesDetail", {
    segment: "greater-rhea",
  });
});

it("asks for a country through the list in picker mode and takes its segment back", async () => {
  mockRoute = createRouteMock("TerritoryCompare", undefined);

  await render(<TerritoryCompareScreen />);
  await fireEvent.press(screen.getByTestId("territory-pick-1"));

  expect(mockNavigation.push).toHaveBeenCalledWith("TerritoryList", {
    title: "pick_country",
    pickerKey: "territory-compare-1",
  });

  // The picker answers through the registry, outside React's knowledge.
  await act(async () =>
    callNavigationCallback("territory-compare-1", { segment: "chile" }),
  );

  expect(mockUseQuery.mock.calls.at(-1)![0].queryKey).toEqual([
    "TerritoryCompare",
    null,
    "chile",
    "en",
  ]);
});

it("fills the card from the picked country, not from the comparison response", async () => {
  // Regression: the response only exists once *both* sides are set, so a card
  // reading only from it kept saying "pick a country" after the first pick and
  // the choice looked like it hadn't registered.
  mockRoute = createRouteMock("TerritoryCompare", undefined);
  mockUseQuery.mockReturnValue(queryResult({ data: undefined }));

  await render(<TerritoryCompareScreen />);
  await fireEvent.press(screen.getByTestId("territory-pick-0"));
  await act(async () =>
    callNavigationCallback("territory-compare-0", {
      segment: "argentina",
      name: "Argentina",
      code: "AR",
    }),
  );

  expect(screen.getByText("Argentina")).toBeOnTheScreen();
  expect(screen.getByText("🇦🇷")).toBeOnTheScreen();
  // The other side is still empty and still invites a pick.
  expect(screen.getByText("pick_country")).toBeOnTheScreen();
});

it("names the country a single segment came in with, from its own detail query", async () => {
  // Regression: arriving from the country page only the segment is passed, so
  // the card showed a globe and the raw latin slug until the *other* country
  // was picked and the comparison response arrived.
  mockRoute = createRouteMock("TerritoryCompare", { segment1: "argentina" });
  mockUseQuery.mockImplementation(({ queryKey }: { queryKey: unknown[] }) =>
    queryKey[0] === "TerritoryDetail"
      ? { data: queryKey[1] ? { name: "Argentina", code: "AR" } : undefined }
      : queryResult({ data: undefined }),
  );

  await render(<TerritoryCompareScreen />);

  expect(screen.getByText("Argentina")).toBeOnTheScreen();
  expect(screen.getByText("🇦🇷")).toBeOnTheScreen();
  expect(screen.queryByText("argentina")).toBeNull();
});

it("falls back to the server's names for a link that carried only segments", async () => {
  await render(<TerritoryCompareScreen />);

  expect(screen.getByText("Argentina")).toBeOnTheScreen();
  expect(screen.getByText("Chile")).toBeOnTheScreen();
});

it("waits for both countries before asking the server", async () => {
  mockRoute = createRouteMock("TerritoryCompare", { segment1: "argentina" });
  mockUseQuery.mockReturnValue(queryResult({ data: undefined }));

  await render(<TerritoryCompareScreen />);

  expect(mockUseQuery.mock.calls.at(-1)![0].enabled).toBe(false);
  expect(screen.getByText("compare_territories_hint")).toBeOnTheScreen();
  // No tabs to switch between while there is nothing to compare.
  expect(screen.queryByTestId("tabs")).toBeNull();
});

it("offers a retry when the comparison could not be loaded", async () => {
  const result = queryResult({ data: undefined, isError: true });
  mockUseQuery.mockReturnValue(result);

  await render(<TerritoryCompareScreen />);
  await fireEvent.press(screen.getByText("try_again"));

  expect(result.refetch).toHaveBeenCalled();
});

// The IconsHeader props the screen hands to setOptions, read straight off the
// headerRight element without mounting it.
const headerProps = (): Record<string, unknown> => {
  const options = (mockNavigation.setOptions as jest.Mock).mock.calls.at(-1)![0];
  return options.headerRight().props;
};

it("shares the comparison at the site's own two-country path", async () => {
  const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({
    action: "sharedAction",
  } as never);

  await render(<TerritoryCompareScreen />);
  await (headerProps().onSharePress as () => Promise<void>)();

  const arg = shareSpy.mock.calls[0][0] as { url?: string; message?: string };
  expect(arg.url ?? arg.message ?? "").toContain(
    "/territory_compare/argentina/chile/",
  );
});

it("offers no share action until both countries are picked", async () => {
  mockRoute = createRouteMock("TerritoryCompare", undefined);

  await render(<TerritoryCompareScreen />);

  expect(headerProps().onSharePress).toBeUndefined();
});
