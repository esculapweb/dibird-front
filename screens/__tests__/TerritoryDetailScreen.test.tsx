// jest.config.js's setupFiles path only evaluates the async-storage mock
// without wiring it up as a replacement — the sort preference reads it.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
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
jest.mock("../../util/fetches", () => ({ fetchTerritoryDetail: jest.fn() }));
jest.mock("../../hooks/useContentWidth", () => ({ useContentWidth: () => 400 }));
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
jest.mock("../../components/ui/Tabs", () => {
  const { Pressable, Text, View } = require("react-native");
  return {
    __esModule: true,
    default: ({
      tabOptions,
      setTabsMode,
    }: {
      tabOptions: { value: string; labelKey: string }[];
      setTabsMode: (value: string) => void;
    }) => (
      <View testID="tabs">
        {tabOptions.map((tab) => (
          <Pressable
            key={tab.value}
            testID={`tab-${tab.value}`}
            onPress={() => setTabsMode(tab.value)}
          >
            <Text>{tab.labelKey}</Text>
          </Pressable>
        ))}
      </View>
    ),
  };
});
jest.mock("../../components/ui/IconsHeader", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: () => <View testID="icons-header" /> };
});
jest.mock("react-native-render-html", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ source }: { source: { html: string } }) => (
      <Text>{source.html}</Text>
    ),
  };
});
jest.mock("../../components/Territory/TerritoryChecklist", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      mockChecklistProps = props;
      return <View testID="territory-checklist">{props.listHeader as never}</View>;
    },
  };
});
jest.mock("../../services/bottomSheet", () => ({
  BottomSheet: {
    showContent: ({
      renderContent,
    }: {
      renderContent: (dismiss: () => void) => unknown;
    }) => {
      mockSheetContent = renderContent(() => {}) as never;
    },
  },
}));
jest.mock("../../components/Taxonomy/TaxonFilterSheet", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => <View {...props} />,
    hasTraitFilters: (filters: Record<string, unknown>) =>
      Object.keys(filters ?? {}).length > 0,
  };
});
jest.mock("../../components/Taxonomy/TaxonChildrenList", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      mockFlatListProps = props;
      return <View testID="flat-species-list">{props.listHeader as never}</View>;
    },
  };
});

import { ReactElement } from "react";
import { Share } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useQuery } from "@tanstack/react-query";
import { createNavigationMock, createRouteMock } from "../test-utils";
import TerritoryDetailScreen from "../TerritoryDetailScreen";
import { TerritoryDetail } from "../../types";

let mockRoute: ReturnType<typeof createRouteMock>;
let mockChecklistProps: Record<string, unknown>;
let mockSheetContent: ReactElement<Record<string, unknown>> | null;
let mockFlatListProps: Record<string, unknown>;
const mockNavigation = createNavigationMock();
const mockUseQuery = useQuery as jest.Mock;

const DETAIL: TerritoryDetail = {
  id_avibase: 6142,
  territory_id: 52,
  name: "Argentina",
  name_loct: "Argentina",
  code: "AR",
  metadata: {
    title: "",
    meta_description: "",
    h1: "",
    short: "<p>Second in South America only to Brazil.</p>",
  },
  region: { name: "South America", code_google: "005", name_gent: "South America" },
  count: { "2": "27 orders", "3": "88 families", "5": "1111 species" },
  paging: {
    prev: { segment: "chile", name: "Chile", code: "CL" },
    next: { segment: "bolivia", name: "Bolivia", code: "BO" },
  },
  alternates: [],
};

const mockDetail = (overrides: Record<string, unknown> = {}) =>
  mockUseQuery.mockReturnValue({
    data: DETAIL,
    isLoading: false,
    isError: false,
    isRefetching: false,
    error: null,
    refetch: jest.fn(),
    ...overrides,
  });

// The IconsHeader props the screen hands to setOptions, read straight off the
// headerRight element without mounting it.
const headerProps = (): Record<string, unknown> => {
  const options = (mockNavigation.setOptions as jest.Mock).mock.calls.at(-1)![0];
  return options.headerRight().props;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSheetContent = null;
  mockRoute = createRouteMock("TerritoryDetail", { segment: "argentina" });
  mockDetail();
});

it("shows the flag, the name, its region, the counts and the description", async () => {
  await render(<TerritoryDetailScreen />);
  await fireEvent.press(screen.getByTestId("tab-info"));

  expect(screen.getByText("🇦🇷")).toBeOnTheScreen();
  expect(screen.getByText("Argentina")).toBeOnTheScreen();
  expect(screen.getByText("region: South America")).toBeOnTheScreen();
  expect(screen.getByText("27 orders")).toBeOnTheScreen();
  expect(screen.getByText("1111 species")).toBeOnTheScreen();
  expect(
    screen.getByText("<p>Second in South America only to Brazil.</p>"),
  ).toBeOnTheScreen();
});

it("opens on the birds, with the country page behind its own tab", async () => {
  // The species are what the page is for; the description is a second read.
  await render(<TerritoryDetailScreen />);

  expect(screen.getByTestId("territory-checklist")).toBeOnTheScreen();
  expect(
    screen.queryByText("<p>Second in South America only to Brazil.</p>"),
  ).toBeNull();

  await fireEvent.press(screen.getByTestId("tab-info"));

  expect(screen.queryByTestId("territory-checklist")).toBeNull();
  expect(
    screen.getByText("<p>Second in South America only to Brazil.</p>"),
  ).toBeOnTheScreen();
});

it("opens on the order/family/species tree, keyed by our own territory id", async () => {
  await render(<TerritoryDetailScreen />);

  expect(screen.getByTestId("territory-checklist")).toBeOnTheScreen();
  expect(screen.queryByTestId("flat-species-list")).toBeNull();
  // /myapi/checklist2/ takes Territory.pk, not the Avibase id.
  expect(mockChecklistProps.territoryId).toBe(52);
});

it("switches to the plain species list, filtered to the country", async () => {
  await render(<TerritoryDetailScreen />);

  await fireEvent.press(screen.getByTestId("species-view-flat"));

  expect(screen.getByTestId("flat-species-list")).toBeOnTheScreen();
  expect(screen.queryByTestId("territory-checklist")).toBeNull();
  expect(mockFlatListProps.rank).toBe(5);
  // The country is the page, not a filter the user can drop.
  expect(mockFlatListProps.fixedTraits).toEqual({ territory: 52 });
  expect(mockFlatListProps.traits).toEqual({});
});

it("offers the trait filters only on the flat list, and without the country", async () => {
  // The tree comes from the checklist endpoint, which takes no trait filters;
  // and the country dropdown would quietly turn this into another page's list.
  await render(<TerritoryDetailScreen />);
  expect(headerProps().onFilterPress).toBeUndefined();

  await fireEvent.press(screen.getByTestId("species-view-flat"));
  (headerProps().onFilterPress as () => void)();

  expect(mockSheetContent).not.toBeNull();
  expect(mockSheetContent!.props.showCountry).toBe(false);
});

it("narrows the country's species list by the filters picked in the sheet", async () => {
  await render(<TerritoryDetailScreen />);
  await fireEvent.press(screen.getByTestId("species-view-flat"));
  (headerProps().onFilterPress as () => void)();

  await act(async () =>
    (mockSheetContent!.props.onApply as (f: object) => void)({
      status: ["EN", "CR"],
    }),
  );

  expect(mockFlatListProps.traits).toEqual({ status: ["EN", "CR"] });
  expect(mockFlatListProps.fixedTraits).toEqual({ territory: 52 });
  expect(headerProps().hasActiveFilters).toBe(true);
});

it("offers a sort only on the flat list — the tree is taxonomic by definition", async () => {
  await render(<TerritoryDetailScreen />);
  expect(headerProps().onSortPress).toBeUndefined();

  await fireEvent.press(screen.getByTestId("species-view-flat"));
  expect(headerProps().onSortPress).toEqual(expect.any(Function));

  // ...and not while the country page is the one on screen.
  await fireEvent.press(screen.getByTestId("tab-info"));
  expect(headerProps().onSortPress).toBeUndefined();
});

it("says so instead of showing an empty list when a stale cache has no territory id", async () => {
  // Responses cached before the backend started sending territory_id have
  // nothing to key either species view with.
  mockDetail({ data: { ...DETAIL, territory_id: undefined } });

  await render(<TerritoryDetailScreen />);

  expect(screen.queryByTestId("territory-checklist")).toBeNull();
  expect(screen.getByText("taxonomy_unavailable")).toBeOnTheScreen();
});

it("walks to the neighbouring countries, flag first", async () => {
  await render(<TerritoryDetailScreen />);
  await fireEvent.press(screen.getByTestId("tab-info"));

  expect(screen.getByText("🇧🇴")).toBeOnTheScreen();
  expect(screen.getByText("🇨🇱")).toBeOnTheScreen();

  await fireEvent.press(screen.getByText("Bolivia"));
  expect(mockNavigation.push).toHaveBeenCalledWith("TerritoryDetail", {
    segment: "bolivia",
  });
});

it("shows an error overlay with retry when the country could not be loaded", async () => {
  const refetch = jest.fn();
  mockDetail({
    data: undefined,
    isError: true,
    error: { message: "boom" },
    refetch,
  });

  await render(<TerritoryDetailScreen />);
  expect(screen.getByText("countries_unavailable")).toBeOnTheScreen();

  await fireEvent.press(screen.getByText("try_again"));
  expect(refetch).toHaveBeenCalled();
});

it("redirects to the canonical segment via setParams when the API returns a redirect", async () => {
  // The redirect response is partial — no metadata, count or paging — so the
  // screen must not read through them before the refetch lands.
  mockDetail({
    data: {
      redirect: "argentina",
      name: null,
      name_loct: null,
      code: null,
      metadata: {},
      count: null,
      alternates: [],
    },
  });

  await render(<TerritoryDetailScreen />);

  expect(mockNavigation.setParams).toHaveBeenCalledWith({
    segment: "argentina",
  });
  expect(screen.getByTestId("loading-overlay")).toBeOnTheScreen();
});

it("shares the country at the site's own path", async () => {
  const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({
    action: "sharedAction",
  } as never);

  await render(<TerritoryDetailScreen />);
  await (headerProps().onSharePress as () => Promise<void>)();

  const arg = shareSpy.mock.calls[0][0] as { url?: string; message?: string };
  expect(arg.url ?? arg.message ?? "").toContain("/territory/argentina/");
});

it("starts a comparison with this country already on one side", async () => {
  await render(<TerritoryDetailScreen />);
  const [compare] = headerProps().headerRightBeginning as {
    onPress: () => void;
  }[];
  compare.onPress();

  expect(mockNavigation.navigate).toHaveBeenCalledWith("TerritoryCompare", {
    segment1: "argentina",
  });
});

// What a shared link restores. The screen holds this in tabs and switches
// rather than in a filter sheet, so without it a link sent from the species
// list drops the reader on the description.
it("opens on the tab a shared link was sent from", async () => {
  mockRoute = createRouteMock("TerritoryDetail", {
    segment: "argentina",
    initialTab: "info",
  });

  await render(<TerritoryDetailScreen />);

  expect(screen.getByText("Argentina")).toBeOnTheScreen();
  expect(screen.queryByTestId("territory-checklist")).toBeNull();
});

it("opens the flat list, sorted and filtered, from a shared link", async () => {
  mockRoute = createRouteMock("TerritoryDetail", {
    segment: "argentina",
    initialView: "flat",
    initialSort: "name",
    initialTraits: { habitat: ["Forest"] },
  });

  await render(<TerritoryDetailScreen />);

  expect(screen.getByTestId("flat-species-list")).toBeOnTheScreen();
  expect(mockFlatListProps.sort).toBe("name");
  expect(mockFlatListProps.traits).toEqual({ habitat: ["Forest"] });
});

it("shares the tree layout as the plain country link", async () => {
  const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({
    action: "sharedAction",
  } as never);

  await render(<TerritoryDetailScreen />);
  await (headerProps().onSharePress as () => Promise<void>)();

  const arg = shareSpy.mock.calls[0][0] as { url?: string; message?: string };
  expect(arg.url ?? arg.message ?? "").toMatch(/\/territory\/argentina\/$/);
});

it("shares the open tab and layout", async () => {
  const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({
    action: "sharedAction",
  } as never);

  await render(<TerritoryDetailScreen />);
  await fireEvent.press(screen.getByTestId("tab-info"));
  await (headerProps().onSharePress as () => Promise<void>)();

  const arg = shareSpy.mock.calls[0][0] as { url?: string; message?: string };
  expect(arg.url ?? arg.message ?? "").toContain(
    "/territory/argentina/?tab=info",
  );
});
