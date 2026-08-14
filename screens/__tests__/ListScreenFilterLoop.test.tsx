// Regression test for a full-app freeze, kept apart from ListScreen.test.tsx
// because it is the one case that must NOT mock the pieces that test stubs
// out: the real useSyncedFilters, the real filters-context and the real
// FilterChips (with its useFilterLabels dropdown queries) all have to be in
// the tree for the loop to close.
//
// Clearing the country chip on Community left the places/species dropdown
// queries behind FilterChips on a brand-new query key with no data and
// `enabled: false` — permanently pending, permanently served from
// placeholderData. useDropdownQuery passed `select` and `placeholderData` as
// inline arrows, so react-query's "same placeholder, skip select" check (it
// compares the identity of both against the previous render's) missed every
// render and rebuilt the mapped Map — a fresh reference structural sharing
// cannot dedupe, unlike a plain array. Each new reference notified the
// observer, which re-rendered, which rebuilt the Map: ~30k renders/second,
// pegging the JS thread. The screen it happened on stays mounted when you
// navigate away, so every other screen stopped responding to taps too.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("../../services/db/client", () => ({
  db: {},
  sqliteDb: {},
  runMigrations: jest.fn(async () => {}),
}));
jest.mock("drizzle-orm/expo-sqlite", () => ({
  useLiveQuery: jest.fn(() => ({ data: [], updatedAt: 0 })),
}));
jest.mock("../../store/theme-context", () => ({
  useTheme: () => require("../mockTheme").mockUseTheme(),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../services/i18n", () => ({
  __esModule: true,
  default: { t: (key: string) => key, language: "en" },
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
    default: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});
jest.mock("../../components/ui/LoadingOverlay", () => {
  const { Text } = require("react-native");
  return { __esModule: true, default: () => <Text>loading</Text> };
});
jest.mock("../../components/Error/ErrorOverlay", () => {
  const { Text } = require("react-native");
  return { __esModule: true, default: () => <Text>error</Text> };
});
jest.mock("../../components/ui/HeaderTitleWithBadge", () => {
  const { Text } = require("react-native");
  return { __esModule: true, default: () => <Text>title</Text> };
});
jest.mock("../../components/ui/ItemsList", () => {
  const { Text } = require("react-native");
  return { __esModule: true, default: () => <Text>items</Text> };
});
jest.mock("../../components/Filters/FilterSheetContent", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("../../components/Sort/SortSheetContent", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("../../components/ui/IconsHeader", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("../../services/bottomSheet", () => ({
  BottomSheet: { showContent: jest.fn() },
}));
jest.mock("../../services/sync/networkStatus", () => ({
  subscribeToReconnect: jest.fn(() => () => {}),
  isConnected: () => true,
}));
jest.mock("../../store/language-context", () => ({
  useLanguage: () => ({ language: "en" }),
}));
jest.mock("../../store/location-context", () => ({
  useLocation: () => ({
    locationCoords: null,
    locationAvailable: false,
    permissionStatus: "denied",
    requestLocation: jest.fn(),
  }),
}));
jest.mock("../../store/profile-context", () => ({
  registerOnProfileSaved: jest.fn(() => () => {}),
}));
jest.mock("../../util/fetches", () => ({
  fetchMyCountries: jest.fn(async () => [{ value: 1, label: "Country" }]),
  fetchMyPlaces: jest.fn(async () => [{ value: 2, label: "Place" }]),
  fetchSpecies: jest.fn(async () => [{ value: 3, label: "Species" }]),
}));
// The territory/date the screen starts on: a country plus "this year", which
// is what puts both dropdown queries into a loaded state before the chip goes.
jest.mock("../../util/storageHelper", () => ({
  loadSort: jest.fn(async () => null),
  saveSort: jest.fn(async () => {}),
  loadGlobalTerritory: jest.fn(async () => 1),
  saveGlobalTerritory: jest.fn(async () => {}),
  loadGlobalDateFilter: jest.fn(async () => ({ type: "this_year" })),
  saveGlobalDateFilter: jest.fn(async () => {}),
  loadGlobalPlace: jest.fn(async () => null),
  saveGlobalPlace: jest.fn(async () => {}),
  loadGlobalSpecies: jest.fn(async () => null),
  saveGlobalSpecies: jest.fn(async () => {}),
  clearAllGlobalFilters: jest.fn(async () => {}),
}));

// Counts every FilterChips render — the loop lived entirely inside it, so
// ListScreen's own render count stays low even while the app is frozen.
const chipRenders = { count: 0 };
jest.mock("../../components/Filters/FilterChips", () => {
  const actual = jest.requireActual("../../components/Filters/FilterChips");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      chipRenders.count += 1;
      return actual.default(props);
    },
  };
});

let mockNavigation: ReturnType<typeof createNavigationMock>;
jest.mock("@react-navigation/native", () => {
  const { useEffect } = require("react");
  return {
    useNavigation: () => mockNavigation,
    // Same reasoning as useSyncedFilters.test.tsx's mock: the focus callback
    // calls setFilters, so it has to run as a real effect rather than during
    // render.
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  };
});

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FiltersProvider } from "../../store/filters-context";
import ListScreen from "../ListScreen";
import { createNavigationMock, createRouteMock } from "../test-utils";

const fetchFunction = jest.fn(async () => ({
  results: [{ id: 1 }],
  pagination: { count: 1, current: 1, final: 1, next: null },
}));

it("settles instead of spinning when the country chip is removed", async () => {
  chipRenders.count = 0;
  mockNavigation = createNavigationMock();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  await render(
    <QueryClientProvider client={queryClient}>
      <FiltersProvider>
        <ListScreen
          route={createRouteMock("Community", {}) as never}
          fetchFunction={fetchFunction as never}
          errorTitle="observations_unavailable"
          renderItem={() => null}
          noItems={{ icon: "binoculars-outline", message: "none", actions: [] }}
          title="community"
          allowedFilters={["territory", "date", "species"]}
        />
      </FiltersProvider>
    </QueryClientProvider>,
  );

  await waitFor(() => expect(fetchFunction).toHaveBeenCalled());
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  await act(async () => {
    fireEvent.press(screen.getByTestId("remove-filter-territory"));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  // The country is gone from the request, the date filter is not.
  expect(fetchFunction).toHaveBeenLastCalledWith(
    expect.objectContaining({ territory: null, date: { type: "this_year" } }),
    expect.anything(),
    expect.anything(),
    1,
    undefined,
  );

  // Renders must stop coming once the state has settled. With the loop this
  // was tens of thousands per second.
  const settled = chipRenders.count;
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 200));
  });
  expect(chipRenders.count - settled).toBe(0);
});
