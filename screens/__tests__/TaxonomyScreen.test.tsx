// jest.config.js's setupFiles path only evaluates the async-storage mock
// without wiring it up as a replacement — the sort preference reads it.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("../../store/theme-context", () => ({
  useTheme: () => require("../mockTheme").mockUseTheme(),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
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
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => <Text>{`icon-${name}`}</Text>,
  };
});
const mockShowMenu = jest.fn();
jest.mock("../../services/bottomSheet", () => ({
  BottomSheet: {
    showMenu: (payload: unknown) => mockShowMenu(payload),
    showContent: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
  },
}));
jest.mock("../../components/ui/IconsHeader", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: () => <View testID="icons-header" /> };
});
jest.mock("../../components/Taxonomy/TaxonChildrenList", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      mockListProps = props;
      return <View testID="children-list">{props.listHeader as never}</View>;
    },
  };
});
jest.mock("../../hooks/useTaxonomySort", () => ({
  useTaxonomySort: (pinnedSort?: string) => ({
    sort: pinnedSort ?? "ioc_id",
    openSortSheet: jest.fn(),
  }),
}));

import { Share } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import {
  createNavigationMock,
  createRouteMock,
  openOverflow,
  overflowRow,
} from "../test-utils";
import TaxonomyScreen from "../TaxonomyScreen";
import { setNavigationCallback } from "../../util/navigationCallbacks";

let mockRoute: ReturnType<typeof createRouteMock>;
let mockListProps: Record<string, unknown>;
const mockNavigation = createNavigationMock();

// The IconsHeader props the screen hands to setOptions, read straight off the
// headerRight element without mounting it. Sharing is no longer one of them —
// it lives in the "⋯" menu (see openOverflow).
const headerProps = (): Record<string, unknown> => {
  const options = (mockNavigation.setOptions as jest.Mock).mock.calls.at(-1)![0];
  return options.headerRight().props;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRoute = createRouteMock("Taxonomy", { rank: 2 });
});

it("passes the saved sort down to the list", async () => {
  await render(<TaxonomyScreen />);

  expect(mockListProps.sort).toBe("ioc_id");
  expect(mockListProps.rank).toBe(2);
});

it("offers the flat species list and the extinct list from the catalogue root", async () => {
  await render(<TaxonomyScreen />);

  expect(screen.getByText("all_species")).toBeOnTheScreen();
  expect(screen.getByText("extinct_species")).toBeOnTheScreen();
});

it("links from the order tree to the flat species list", async () => {
  await render(<TaxonomyScreen />);

  await fireEvent.press(screen.getByText("all_species"));

  expect(mockNavigation.push).toHaveBeenCalledWith("Taxonomy", {
    rank: 5,
    title: "species_catalog",
  });
});

it("links back to the order tree from the species list, so neither root is a dead end", async () => {
  mockRoute = createRouteMock("Taxonomy", { rank: 5 });

  await render(<TaxonomyScreen />);
  await fireEvent.press(screen.getByText("browse_by_groups"));

  expect(mockNavigation.push).toHaveBeenCalledWith("Taxonomy", { rank: 2 });
});

it("offers no cross-links while picking a species for the comparison", async () => {
  mockRoute = createRouteMock("Taxonomy", { rank: 5, pickerKey: "x" });

  await render(<TaxonomyScreen />);

  expect(screen.queryByText("browse_by_groups")).toBeNull();
});

it("opens the extinct species list", async () => {
  await render(<TaxonomyScreen />);

  await fireEvent.press(screen.getByText("extinct_species"));

  expect(mockNavigation.push).toHaveBeenCalledWith("Taxonomy", {
    rank: 5,
    extinct: true,
    title: "extinct_species",
  });
});

it("hides the shortcuts once you are inside a rank", async () => {
  mockRoute = createRouteMock("Taxonomy", {
    rank: 3,
    parentSegment: "hawks-and-relatives",
    parentRank: 2,
  });

  await render(<TaxonomyScreen />);

  expect(screen.queryByText("all_species")).toBeNull();
  expect(mockListProps.parent).toEqual({
    segment: "hawks-and-relatives",
    rank: 2,
  });
});

it("hands a picked species to the caller instead of opening it", async () => {
  mockRoute = createRouteMock("Taxonomy", {
    rank: 5,
    pickerKey: "species-compare-b",
  });
  const received: unknown[] = [];
  setNavigationCallback("species-compare-b", (item) => received.push(item));

  await render(<TaxonomyScreen />);
  (mockListProps.onPick as (item: unknown) => void)({ segment: "osprey" });

  expect(received).toEqual([{ segment: "osprey" }]);
  expect(mockNavigation.goBack).toHaveBeenCalled();
  expect(mockNavigation.navigate).not.toHaveBeenCalled();
});

it("opens species normally when it is not picking", async () => {
  mockRoute = createRouteMock("Taxonomy", { rank: 5 });

  await render(<TaxonomyScreen />);

  expect(mockListProps.onPick).toBeUndefined();
});

it("passes the trait filters down and can clear them", async () => {
  mockRoute = createRouteMock("Taxonomy", { rank: 5 });

  await render(<TaxonomyScreen />);

  expect(mockListProps.traits).toEqual({});
  expect(typeof mockListProps.onClearTraits).toBe("function");
});

it("seeds the filters from a shared deep link", async () => {
  mockRoute = createRouteMock("Taxonomy", {
    rank: 5,
    initialTraits: { territory: 5, mass_min: 1000 },
  });

  await render(<TaxonomyScreen />);

  expect(mockListProps.traits).toEqual({ territory: 5, mass_min: 1000 });
});

it("shares the catalogue with its current filters", async () => {
  const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({
    action: "sharedAction",
  } as never);
  mockRoute = createRouteMock("Taxonomy", {
    rank: 5,
    initialTraits: { territory: 5 },
  });

  await render(<TaxonomyScreen />);
  overflowRow(
    openOverflow(headerProps().headerRightEnd, mockShowMenu),
    "share",
  ).onPress();

  const arg = shareSpy.mock.calls[0][0] as { url?: string; message?: string };
  const shared = arg.url ?? arg.message ?? "";
  expect(shared).toContain("/species/?territory=5");
});

it("offers no share action while picking a species", async () => {
  mockRoute = createRouteMock("Taxonomy", { rank: 5, pickerKey: "x" });

  await render(<TaxonomyScreen />);

  // Its only row gone, the menu button goes with it rather than opening empty.
  expect(() =>
    openOverflow(headerProps().headerRightEnd, mockShowMenu),
  ).toThrow();
});

it("shares the extinct list at its own path", async () => {
  const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({
    action: "sharedAction",
  } as never);
  mockRoute = createRouteMock("Taxonomy", { rank: 5, extinct: true });

  await render(<TaxonomyScreen />);
  overflowRow(
    openOverflow(headerProps().headerRightEnd, mockShowMenu),
    "share",
  ).onPress();

  const arg = shareSpy.mock.calls[0][0] as { url?: string; message?: string };
  expect(arg.url ?? arg.message ?? "").toContain("/extinct/");
});

it("applies the sort pinned by a shared link", async () => {
  mockRoute = createRouteMock("Taxonomy", { rank: 5, initialSort: "name" });

  await render(<TaxonomyScreen />);

  expect(mockListProps.sort).toBe("name");
});

it("titles the extinct deep link 'extinct species', not the plain species list", async () => {
  // The dibird://extinct/ deep link opens rank 5 with extinct:true and no
  // title — without the extinct branch the header would read "species".
  mockRoute = createRouteMock("Taxonomy", { rank: 5, extinct: true });

  await render(<TaxonomyScreen />);

  const options = (mockNavigation.setOptions as jest.Mock).mock.calls.at(-1)![0];
  expect(options.title).toBe("extinct_species");
});

it("shares the orders list at its own path", async () => {
  const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({
    action: "sharedAction",
  } as never);
  mockRoute = createRouteMock("Taxonomy", { rank: 2 });

  await render(<TaxonomyScreen />);
  overflowRow(
    openOverflow(headerProps().headerRightEnd, mockShowMenu),
    "share",
  ).onPress();

  const arg = shareSpy.mock.calls[0][0] as { url?: string; message?: string };
  expect(arg.url ?? arg.message ?? "").toContain("/order/");
});

it("offers no share on a nested list", async () => {
  mockRoute = createRouteMock("Taxonomy", {
    rank: 3,
    parentSegment: "hawks-and-relatives",
    parentRank: 2,
  });

  await render(<TaxonomyScreen />);

  expect(() =>
    openOverflow(headerProps().headerRightEnd, mockShowMenu),
  ).toThrow();
});

it("autofocuses and relabels the search on the species list", async () => {
  mockRoute = createRouteMock("Taxonomy", { rank: 5, focusSearch: true });

  await render(<TaxonomyScreen />);

  expect(mockListProps.autoFocusSearch).toBe(true);
  expect(mockListProps.searchPlaceholder).toBe("search_species_hint");
});
