jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
}));
jest.mock("../../../hooks/useList", () => ({ useList: jest.fn() }));
jest.mock("../../../hooks/useDebounce", () => ({
  useDebounce: (value: string) => value,
}));
jest.mock("../../../util/fetches", () => ({
  fetchTaxonList: jest.fn(() => jest.fn()),
}));
jest.mock("../../ui/ItemsList", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      mockItemsListProps = props;
      // Only the header is rendered here; rows go through the captured
      // renderItem instead (see renderRow), because a jest.mock factory may
      // not reference anything from module scope — type annotations included.
      return <View testID="items-list">{props.listHeader as never}</View>;
    },
  };
});
jest.mock("../../ui/SearchInput", () => {
  const { View, Text, TextInput, Pressable } = require("react-native");
  return {
    __esModule: true,
    default: ({
      value,
      onChange,
      onClear,
      placeholder,
    }: {
      value: string;
      onChange: (next: string) => void;
      onClear: () => void;
      placeholder?: string;
    }) => (
      <View>
        <TextInput
          testID="search-input"
          value={value}
          placeholder={placeholder}
          onChangeText={onChange}
        />
        <Pressable testID="clear-search" onPress={onClear}>
          <Text>clear</Text>
        </Pressable>
      </View>
    ),
  };
});
jest.mock("../TaxonRow", () => {
  const { Pressable, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({
      title,
      latin,
      occurrence,
      onPress,
    }: {
      title: string;
      latin?: string;
      occurrence?: string | null;
      onPress: () => void;
    }) => (
      <Pressable onPress={onPress}>
        <Text>{title}</Text>
        {!!latin && <Text>{latin}</Text>}
        {!!occurrence && <Text testID="row-occurrence">{occurrence}</Text>}
      </Pressable>
    ),
  };
});
jest.mock("../TaxonFilterChips", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: () => <View testID="taxon-filter-chips" />,
  };
});

import { ReactElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { createNavigationMock } from "../../../screens/test-utils";
import TaxonChildrenList from "../TaxonChildrenList";
import { useList } from "../../../hooks/useList";
import { fetchTaxonList } from "../../../util/fetches";
import { TaxonListItem, TaxonTraitFilters } from "../../../types";

let mockItemsListProps: Record<string, unknown>;
const mockNavigation = createNavigationMock();
const mockUseList = useList as jest.Mock;
const mockFetchTaxonList = fetchTaxonList as jest.Mock;

const SPECIES: TaxonListItem[] = [
  {
    segment: "osprey",
    name: "Osprey / Pandion haliaetus",
    name_lang: "Osprey",
    thumb: null,
    status: "LC",
  },
];

const listResult = (overrides: Record<string, unknown> = {}) => ({
  data: {
    pages: [{ results: [], pagination: { count: 42 } }],
  },
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

// A loaded page of results, for the tests that care about the rows themselves.
const loadedWith = (results: TaxonListItem[]) =>
  listResult({ data: { pages: [{ results, pagination: { count: 1 } }] } });

const renderList = (traits?: TaxonTraitFilters) =>
  render(
    <TaxonChildrenList
      speciesSource="catalog"
      rank={5}
      errorTitle="taxonomy_unavailable"
      emptyMessage="no_species_found"
      traits={traits}
    />,
  );

const listOptions = () => mockUseList.mock.calls.at(-1)![0];

// Renders one row the way the list would: the captured renderItem hands back
// the real element, onPress closure included.
const renderRow = (item: TaxonListItem) =>
  render(
    (mockItemsListProps.renderItem as (arg: { item: TaxonListItem }) => ReactElement)({ item }),
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockUseList.mockReturnValue(listResult());
});

it("passes the trait filters to the fetch function", async () => {
  await renderList({ mass_min: 1000, habitat: ["Forest"] });

  expect(mockFetchTaxonList).toHaveBeenCalledWith(5, undefined, undefined, {
    mass_min: 1000,
    habitat: ["Forest"],
  });
});

it("puts the filters in the query key, or react-query serves the unfiltered pages", async () => {
  // useList builds its key from screenName/filters/sort/search only — the
  // trait filters live inside fetchTaxonList's closure, invisible to it.
  await renderList({ mass_min: 1000, habitat: ["Forest"] });

  expect(listOptions().screenName).toContain('"mass_min":1000');
  expect(listOptions().screenName).toContain('"habitat":["Forest"]');
});

it("keys the same filters identically regardless of the order they were set in", async () => {
  await renderList({ mass_min: 1000, habitat: ["Forest"] });
  const [{ screenName: a }] = mockUseList.mock.calls[0];

  await renderList({ habitat: ["Forest"], mass_min: 1000 });
  const [{ screenName: b }] = mockUseList.mock.calls.at(-1)!;

  expect(b).toEqual(a);
});

it("shows how many species the filters left", async () => {
  await renderList({ mass_min: 1000 });

  expect(screen.getByText("found: 42")).toBeOnTheScreen();
});

it("keeps the count out of the way when nothing is filtered", async () => {
  await renderList();

  expect(screen.queryByText("found: 42")).toBeNull();
});

it("shows the removable filter chips once per-filter removal is wired in", async () => {
  const { rerender } = await renderList({ mass_min: 1000 });
  // No onChangeTraits: nothing to remove a single chip with, so no chips row.
  expect(screen.queryByTestId("taxon-filter-chips")).toBeNull();

  await rerender(
    <TaxonChildrenList
      speciesSource="catalog"
      rank={5}
      errorTitle="taxonomy_unavailable"
      emptyMessage="no_species_found"
      traits={{ mass_min: 1000 }}
      onChangeTraits={jest.fn()}
    />,
  );

  expect(screen.getByTestId("taxon-filter-chips")).toBeOnTheScreen();
});

it("offers to clear the filters, not just the search, when nothing matches", async () => {
  const onClearTraits = jest.fn();
  await render(
    <TaxonChildrenList
      speciesSource="catalog"
      rank={5}
      errorTitle="taxonomy_unavailable"
      emptyMessage="no_species_found"
      traits={{ mass_min: 1000 }}
      onClearTraits={onClearTraits}
    />,
  );

  expect(mockItemsListProps.emptyType).toBe("filtered");
  (mockItemsListProps.onClear as () => void)();
  expect(onClearTraits).toHaveBeenCalled();
});

it("holds the list back until the first page is in", async () => {
  mockUseList.mockReturnValue(listResult({ isLoading: true, data: undefined }));

  await renderList();

  // An empty ItemsList would read as "no such species" while it is loading.
  expect(screen.queryByTestId("items-list")).toBeNull();
});

it("offers a retry when the first page could not be loaded", async () => {
  const result = listResult({
    isLoading: false,
    data: undefined,
    isError: true,
    error: new Error("Network Error"),
  });
  mockUseList.mockReturnValue(result);

  await renderList();
  expect(screen.getByText("taxonomy_unavailable")).toBeOnTheScreen();
  expect(screen.getByText("Network Error")).toBeOnTheScreen();

  await fireEvent.press(screen.getByText("try_again"));
  expect(result.refetch).toHaveBeenCalled();
});

it("keeps showing the cached pages when a refetch fails", async () => {
  // Offline with a persisted cache: an error next to data is not a dead end.
  mockUseList.mockReturnValue(
    listResult({
      ...loadedWith(SPECIES),
      isError: true,
      error: new Error("Network Error"),
    }),
  );

  await renderList();

  expect(screen.queryByText("taxonomy_unavailable")).toBeNull();
  expect(mockItemsListProps.data).toEqual(SPECIES);
});

it("flattens the loaded pages into one list", async () => {
  mockUseList.mockReturnValue(
    listResult({
      data: {
        pages: [
          { results: SPECIES, pagination: { count: 2 } },
          { results: [{ ...SPECIES[0], segment: "black-kite" }], pagination: { count: 2 } },
        ],
      },
    }),
  );

  await renderList();

  expect((mockItemsListProps.data as TaxonListItem[]).map((i) => i.segment)).toEqual([
    "osprey",
    "black-kite",
  ]);
});

it("keys the rows by segment", async () => {
  // Species rows come from a .values() queryset and can arrive without an id,
  // so the segment is the only identity every rank is guaranteed to have.
  await renderList();

  expect(
    (mockItemsListProps.keyExtractor as (item: TaxonListItem) => string)(SPECIES[0]),
  ).toBe("osprey");
});

it("shows the localized name of a taxon with the latin one below", async () => {
  mockUseList.mockReturnValue(loadedWith(SPECIES));

  await renderList();
  await renderRow(SPECIES[0]);

  expect(screen.getByText("Osprey")).toBeOnTheScreen();
  expect(screen.getByText("Pandion haliaetus")).toBeOnTheScreen();
});

it("says how the species occurs on the country the list is filtered by", async () => {
  mockUseList.mockReturnValue(
    loadedWith([{ ...SPECIES[0], occurrence: "Rare/Accidental" }]),
  );

  await renderList({ territory: 52 });
  await renderRow({ ...SPECIES[0], occurrence: "Rare/Accidental" });

  expect(screen.getByTestId("row-occurrence")).toHaveTextContent(
    "country_status_rare_accidental",
  );
});

it("leaves out an occurrence that only spells out the IUCN badge", async () => {
  // A third of Avibase's statuses just write the category out ("Vulnerable"),
  // which the coloured badge next to it already says.
  const vulnerable = {
    ...SPECIES[0],
    status: "VU",
    occurrence: "Vulnerable",
  };
  mockUseList.mockReturnValue(loadedWith([vulnerable]));

  await renderList({ territory: 52 });
  await renderRow(vulnerable);

  expect(screen.queryByTestId("row-occurrence")).toBeNull();
});

it("opens the species page from a species row", async () => {
  mockUseList.mockReturnValue(loadedWith(SPECIES));

  await renderList();
  await renderRow(SPECIES[0]);
  await fireEvent.press(screen.getByText("Osprey"));

  expect(mockNavigation.navigate).toHaveBeenCalledWith("SpeciesDetail", {
    segment: "osprey",
    source: "catalog",
  });
});

it("opens a group at its own rank from the other ranks", async () => {
  const family: TaxonListItem = {
    segment: "pandionidae",
    name: "Pandionidae",
    name_lang: "Pandionidae",
    thumb: null,
  };
  mockUseList.mockReturnValue(loadedWith([family]));

  await render(
    <TaxonChildrenList
      speciesSource="catalog"
      rank={3}
      errorTitle="taxonomy_unavailable"
      emptyMessage="no_species_found"
    />,
  );
  await renderRow(family);
  await fireEvent.press(screen.getByText("Pandionidae"));

  expect(mockNavigation.navigate).toHaveBeenCalledWith("TaxonGroupDetail", {
    segment: "pandionidae",
    rank: 3,
  });
});

it("hands the species to the picker instead of opening it", async () => {
  // Species comparison reuses this list in picker mode.
  const onPick = jest.fn();
  mockUseList.mockReturnValue(loadedWith(SPECIES));

  await render(
    <TaxonChildrenList
      speciesSource="catalog"
      rank={5}
      errorTitle="taxonomy_unavailable"
      emptyMessage="no_species_found"
      onPick={onPick}
    />,
  );
  await renderRow(SPECIES[0]);
  await fireEvent.press(screen.getByText("Osprey"));

  expect(onPick).toHaveBeenCalledWith(SPECIES[0]);
  expect(mockNavigation.navigate).not.toHaveBeenCalled();
});

it("asks for the next page when the list runs out", async () => {
  const result = listResult({ ...loadedWith(SPECIES), hasNextPage: true });
  mockUseList.mockReturnValue(result);

  await renderList();
  (mockItemsListProps.onEndReached as () => void)();

  expect(result.fetchNextPage).toHaveBeenCalled();
});

it("does not stack up page requests while one is in flight", async () => {
  const result = listResult({
    ...loadedWith(SPECIES),
    hasNextPage: true,
    isFetchingNextPage: true,
  });
  mockUseList.mockReturnValue(result);

  await renderList();
  (mockItemsListProps.onEndReached as () => void)();

  expect(result.fetchNextPage).not.toHaveBeenCalled();
});

it("refetches on pull-to-refresh", async () => {
  // The list is cached for a day and survives restarts, so this is the only
  // way to see a backend change before then.
  const result = listResult(loadedWith(SPECIES));
  mockUseList.mockReturnValue(result);

  await renderList();
  (mockItemsListProps.onRefresh as () => void)();

  expect(result.refetch).toHaveBeenCalled();
});

it("seeds the search box from a shared link", async () => {
  await render(
    <TaxonChildrenList
      speciesSource="catalog"
      rank={5}
      errorTitle="taxonomy_unavailable"
      emptyMessage="no_species_found"
      initialSearch="osprey"
    />,
  );

  expect(screen.getByTestId("search-input").props.value).toBe("osprey");
  expect(listOptions().search).toBe("osprey");
});

it("clears its own search box", async () => {
  await renderList();

  await fireEvent.changeText(screen.getByTestId("search-input"), "osprey");
  expect(screen.getByTestId("search-input").props.value).toBe("osprey");

  await fireEvent.press(screen.getByTestId("clear-search"));
  expect(screen.getByTestId("search-input").props.value).toBe("");
});

it("lets the screen own the search when it has to build a share link with it", async () => {
  const onChangeSearch = jest.fn();
  await render(
    <TaxonChildrenList
      speciesSource="catalog"
      rank={5}
      errorTitle="taxonomy_unavailable"
      emptyMessage="no_species_found"
      search="eagle"
      onChangeSearch={onChangeSearch}
    />,
  );

  expect(screen.getByTestId("search-input").props.value).toBe("eagle");

  await fireEvent.changeText(screen.getByTestId("search-input"), "osprey");
  expect(onChangeSearch).toHaveBeenCalledWith("osprey");
});
