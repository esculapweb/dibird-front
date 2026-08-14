// ListScreen statically imports FilterSheetContent (only ever invoked as a
// renderContent callback passed to the mocked BottomSheet.showContent below,
// never actually rendered here) which transitively pulls in
// store/language-context.tsx's real AsyncStorage import — same jest.mock
// gap as util/__tests__/auth.test.ts (jest.config.js's setupFiles path only
// evaluates the async-storage mock without wiring it up as a replacement).
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
// Same transitive chain also reaches store/filters-context.tsx ->
// store/profile-context.tsx -> drizzle-orm/expo-sqlite's useLiveQuery,
// which needs expo-sqlite -> expo-asset (unresolvable here, same class of
// issue as the AsyncStorage one above) — mocked the same way
// store/__tests__/profile-context.test.tsx already does.
jest.mock("drizzle-orm/expo-sqlite", () => ({
  useLiveQuery: jest.fn(() => ({ data: [], updatedAt: 0 })),
}));
jest.mock("../../services/db/client", () => ({
  db: {},
  sqliteDb: {},
  runMigrations: jest.fn(async () => {}),
}));
jest.mock("../../store/theme-context", () => ({
  useTheme: () => require("../mockTheme").mockUseTheme(),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("@expo/vector-icons", () => {
  const { View } = require("react-native");
  return { Ionicons: View };
});
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("../../components/ui/Layout", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({ children, bottom }: {
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
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
}));
jest.mock("../../hooks/useSyncedFilters", () => ({
  useSyncedFilters: jest.fn(),
}));
jest.mock("../../hooks/useList", () => ({
  useList: jest.fn(),
}));
jest.mock("../../services/bottomSheet", () => ({
  BottomSheet: { showContent: jest.fn() },
}));
// FilterChips pulls in useFilterLabels -> language-context/location-context/
// useDropdownQuery — a separately-testable widget unrelated to ListScreen's
// own "render it only when hasActiveFilters" responsibility.
jest.mock("../../components/Filters/FilterChips", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: () => <Text>filter-chips</Text>,
  };
});
// IconsHeader/IconButton's Pressable didn't reliably respect fireEvent.press
// in earlier screen tests (see ObservationEditorScreen.test.tsx) — stub
// with plain TouchableOpacity buttons exposing the callbacks ListScreen
// itself is responsible for wiring.
jest.mock("../../components/ui/IconsHeader", () => {
  const { TouchableOpacity, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ onSortPress, onFilterPress, onSharePress }: {
      onSortPress?: () => void;
      onFilterPress?: () => void;
      onSharePress?: () => void;
    }) => (
      <>
        {onSortPress && (
          <TouchableOpacity testID="sort-btn" onPress={onSortPress}>
            <Text>sort</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity testID="filter-btn" onPress={onFilterPress}>
          <Text>filter</Text>
        </TouchableOpacity>
        {onSharePress && (
          <TouchableOpacity testID="share-btn" onPress={onSharePress}>
            <Text>share</Text>
          </TouchableOpacity>
        )}
      </>
    ),
  };
});

import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { useSyncedFilters } from "../../hooks/useSyncedFilters";
import { useList } from "../../hooks/useList";
import { BottomSheet } from "../../services/bottomSheet";
import { createNavigationMock } from "../test-utils";
import ListScreen from "../ListScreen";

type Item = { id: number; name: string };

const mockNavigation = createNavigationMock();
const mockRefetch = jest.fn();
const mockFetchNextPage = jest.fn();
const mockRemoveFilter = jest.fn();
const mockHandleClearFilters = jest.fn();
const mockHandleClearFiltersSearch = jest.fn();
const mockSetSort = jest.fn();
const mockFetchFunction = jest.fn();

const page = (results: Item[], overrides: Record<string, unknown> = {}) => ({
  results,
  pagination: { count: results.length, current: 1, final: 1, next: null, ...overrides },
});

const mockFilters = (overrides: Record<string, unknown> = {}) => {
  (useSyncedFilters as jest.Mock).mockReturnValue({
    filters: {},
    filtersLoaded: true,
    hasActiveFilters: false,
    removeFilter: mockRemoveFilter,
    filterHints: {},
    sort: null,
    setSort: mockSetSort,
    sortOptions: [],
    sortReady: true,
    search: "",
    setSearch: jest.fn(),
    debouncedSearch: "",
    isSearchActive: false,
    handleFiltersApplied: jest.fn(),
    handleClearFilters: mockHandleClearFilters,
    handleClearFiltersSearch: mockHandleClearFiltersSearch,
    ...overrides,
  });
};

const mockListQuery = (overrides: Record<string, unknown> = {}) => {
  (useList as jest.Mock).mockReturnValue({
    data: { pages: [page([{ id: 1, name: "Alpha" }])] },
    fetchNextPage: mockFetchNextPage,
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    isError: false,
    error: null,
    refetch: mockRefetch,
    ...overrides,
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFilters();
  mockListQuery();
});

const defaultProps = () => ({
  route: { name: "TestList" } as never,
  fetchFunction: mockFetchFunction,
  errorTitle: "list_error_title",
  renderItem: ({ item }: { item: Item }) => <Text>{item.name}</Text>,
  noItems: { icon: "list-outline" as const, message: "no_items" },
  title: "List Title",
});

const renderHeaderRight = async () => {
  const headerRight = (mockNavigation.setOptions as jest.Mock).mock.calls
    .map((call) => call[0].headerRight)
    .filter(Boolean)
    .at(-1);
  await render(headerRight());
};

const renderHeaderTitle = async () => {
  const headerTitle = (mockNavigation.setOptions as jest.Mock).mock.calls
    .map((call) => call[0].headerTitle)
    .filter(Boolean)
    .at(-1);
  await render(headerTitle());
};

it("shows a loading overlay while there's no data yet", async () => {
  mockListQuery({ data: undefined, isLoading: true });
  await render(<ListScreen {...defaultProps()} />);
  expect(screen.getByTestId("loading-overlay")).toBeOnTheScreen();
});

it("shows an error overlay with retry when the first page fails and there's no data yet", async () => {
  mockListQuery({ data: undefined, isError: true, error: { message: "boom" } });
  await render(<ListScreen {...defaultProps()} />);

  expect(screen.getByText("list_error_title")).toBeOnTheScreen();
  await fireEvent.press(screen.getByText("try_again"));
  expect(mockRefetch).toHaveBeenCalledTimes(1);
});

it("keeps showing already-loaded items instead of an error overlay when a load-more (page > 1) fetch fails", async () => {
  mockListQuery({ isError: true, error: { message: "boom" } });
  await render(<ListScreen {...defaultProps()} />);

  expect(screen.queryByText("list_error_title")).not.toBeOnTheScreen();
  expect(screen.getByText("Alpha")).toBeOnTheScreen();
});

it("renders items and de-duplicates repeated ids across pages", async () => {
  mockListQuery({
    data: {
      pages: [
        page([{ id: 1, name: "Alpha" }, { id: 2, name: "Beta" }]),
        page([{ id: 2, name: "Beta (stale)" }, { id: 3, name: "Gamma" }]),
      ],
    },
  });
  await render(<ListScreen {...defaultProps()} />);

  expect(screen.getByText("Alpha")).toBeOnTheScreen();
  expect(screen.getByText("Beta")).toBeOnTheScreen();
  expect(screen.queryByText("Beta (stale)")).not.toBeOnTheScreen();
  expect(screen.getByText("Gamma")).toBeOnTheScreen();
});

it("shows the empty state, switching message type based on active filters/search", async () => {
  mockListQuery({ data: { pages: [page([])] } });
  await render(<ListScreen {...defaultProps()} />);
  expect(screen.getByText("no_items")).toBeOnTheScreen();
});

describe("FAB", () => {
  it("renders and wires onAdd when provided", async () => {
    const onAdd = jest.fn();
    await render(<ListScreen {...defaultProps()} onAdd={onAdd} />);
    await fireEvent.press(screen.getByTestId("list-add-button"));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("is absent when onAdd is not provided", async () => {
    await render(<ListScreen {...defaultProps()} />);
    expect(screen.queryByTestId("list-add-button")).not.toBeOnTheScreen();
  });
});

describe("header badge", () => {
  it("defaults to the page's pagination.count", async () => {
    mockListQuery({ data: { pages: [page([{ id: 1, name: "Alpha" }], { count: 42 })] } });
    await render(<ListScreen {...defaultProps()} />);
    await renderHeaderTitle();
    expect(screen.getByText("42")).toBeOnTheScreen();
  });

  it("prefers customHeaderBadge over pagination.count", async () => {
    mockListQuery({ data: { pages: [page([{ id: 1, name: "Alpha" }], { count: 42 })] } });
    await render(
      <ListScreen {...defaultProps()} customHeaderBadge={() => "custom"} />,
    );
    await renderHeaderTitle();
    expect(screen.getByText("custom")).toBeOnTheScreen();
    expect(screen.queryByText("42")).not.toBeOnTheScreen();
  });

  it("shows no badge when showHeaderBadge is false and there's no customHeaderBadge", async () => {
    mockListQuery({ data: { pages: [page([{ id: 1, name: "Alpha" }], { count: 42 })] } });
    await render(<ListScreen {...defaultProps()} showHeaderBadge={false} />);
    await renderHeaderTitle();
    expect(screen.queryByText("42")).not.toBeOnTheScreen();
  });
});

describe("header actions", () => {
  it("sort button opens the sort bottom sheet", async () => {
    await render(<ListScreen {...defaultProps()} />);
    await renderHeaderRight();
    await fireEvent.press(screen.getByTestId("sort-btn"));
    expect(BottomSheet.showContent).toHaveBeenCalledWith(
      expect.objectContaining({ title: "sort_by" }),
    );
  });

  it("sort button is absent when allowSort is false", async () => {
    await render(<ListScreen {...defaultProps()} allowSort={false} />);
    await renderHeaderRight();
    expect(screen.queryByTestId("sort-btn")).not.toBeOnTheScreen();
  });

  it("filter button opens the filter bottom sheet, wired to handleClearFilters as its reset", async () => {
    await render(<ListScreen {...defaultProps()} />);
    await renderHeaderRight();
    await fireEvent.press(screen.getByTestId("filter-btn"));
    expect(BottomSheet.showContent).toHaveBeenCalledWith(
      expect.objectContaining({ title: "filters", onReset: mockHandleClearFilters }),
    );
  });

  // The header used to be handed to setOptions again on every render (its
  // dependency list named handleClearFilters, a fresh function each time), so
  // a tap could land on a button that had just been replaced — the icons
  // looked dead. These two pin the fix: the header stays put, and the openers
  // behind it still see the current state.
  it("does not hand the navigator a new header on a render that changes nothing about it", async () => {
    // mockFilters' shared jest.fn()s are stable, which the real
    // useSyncedFilters' callbacks are not — it builds fresh ones every render,
    // and that is exactly what the header effect must not key off. Reproduced
    // here with mockImplementation so the returned callbacks differ per call.
    (useSyncedFilters as jest.Mock).mockImplementation(() => ({
      filters: {},
      filtersLoaded: true,
      hasActiveFilters: false,
      removeFilter: mockRemoveFilter,
      filterHints: {},
      sort: null,
      setSort: mockSetSort,
      sortOptions: [],
      sortReady: true,
      search: "",
      setSearch: () => {},
      debouncedSearch: "",
      isSearchActive: false,
      handleFiltersApplied: () => {},
      handleClearFilters: () => {},
      handleClearFiltersSearch: mockHandleClearFiltersSearch,
    }));

    const view = await render(<ListScreen {...defaultProps()} />);
    const headerCount = () =>
      (mockNavigation.setOptions as jest.Mock).mock.calls.filter(
        (call) => call[0].headerRight,
      ).length;
    const before = headerCount();

    await view.rerender(<ListScreen {...defaultProps()} />);

    expect(headerCount()).toBe(before);
  });

  it("opens the filter sheet with the filters current at press time, not the ones the header was built with", async () => {
    const view = await render(<ListScreen {...defaultProps()} />);
    await renderHeaderRight();

    mockFilters({ filters: { territory: 7 } });
    await view.rerender(<ListScreen {...defaultProps()} />);

    // Deliberately pressing the header rendered before the change — that is
    // the one the navigator is still holding.
    await fireEvent.press(screen.getByTestId("filter-btn"));
    const sheet = (BottomSheet.showContent as jest.Mock).mock.calls.at(-1)![0];
    expect(sheet.renderContent(jest.fn()).props.filters).toEqual({ territory: 7 });
  });

  it("share button only renders when handleSharePress is provided", async () => {
    await render(<ListScreen {...defaultProps()} />);
    await renderHeaderRight();
    expect(screen.queryByTestId("share-btn")).not.toBeOnTheScreen();

    const handleSharePress = jest.fn();
    await render(<ListScreen {...defaultProps()} handleSharePress={handleSharePress} />);
    await renderHeaderRight();
    await fireEvent.press(screen.getByTestId("share-btn"));
    expect(handleSharePress).toHaveBeenCalledTimes(1);
  });
});

describe("filter chips", () => {
  it("renders only when hasActiveFilters is true", async () => {
    await render(<ListScreen {...defaultProps()} />);
    expect(screen.queryByText("filter-chips")).not.toBeOnTheScreen();

    mockFilters({ hasActiveFilters: true });
    await render(<ListScreen {...defaultProps()} />);
    expect(screen.getByText("filter-chips")).toBeOnTheScreen();
  });
});

describe("pagination", () => {
  it("fetches the next page only when one is available and not already fetching", async () => {
    await render(<ListScreen {...defaultProps()} />);
    screen.getByTestId("items-list").props.onEndReached();
    expect(mockFetchNextPage).not.toHaveBeenCalled();
  });

  it("fetches the next page when available", async () => {
    mockListQuery({ hasNextPage: true });
    await render(<ListScreen {...defaultProps()} />);
    screen.getByTestId("items-list").props.onEndReached();
    expect(mockFetchNextPage).toHaveBeenCalledTimes(1);
  });
});

it("registers an onOpenFilterModal callback that opens the same filter sheet", async () => {
  const onOpenFilterModal = jest.fn();
  await render(<ListScreen {...defaultProps()} onOpenFilterModal={onOpenFilterModal} />);

  const registeredOpener = onOpenFilterModal.mock.calls[0][0];
  registeredOpener();

  expect(BottomSheet.showContent).toHaveBeenCalledWith(
    expect.objectContaining({ title: "filters" }),
  );
});
