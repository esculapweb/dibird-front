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
      return <View testID="items-list">{props.listHeader as never}</View>;
    },
  };
});
jest.mock("../../ui/SearchInput", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: () => <View testID="search-input" /> };
});

import { render, screen } from "@testing-library/react-native";
import { createNavigationMock } from "../../../screens/test-utils";
import TaxonChildrenList from "../TaxonChildrenList";
import { useList } from "../../../hooks/useList";
import { fetchTaxonList } from "../../../util/fetches";
import { TaxonTraitFilters } from "../../../types";

let mockItemsListProps: Record<string, unknown>;
const mockNavigation = createNavigationMock();
const mockUseList = useList as jest.Mock;
const mockFetchTaxonList = fetchTaxonList as jest.Mock;

const listResult = (count = 42) => ({
  data: {
    pages: [{ results: [], pagination: { count } }],
  },
  fetchNextPage: jest.fn(),
  hasNextPage: false,
  isFetchingNextPage: false,
  isLoading: false,
  isError: false,
  error: null,
  refetch: jest.fn(),
});

const renderList = (traits?: TaxonTraitFilters) =>
  render(
    <TaxonChildrenList
      rank={5}
      errorTitle="taxonomy_unavailable"
      emptyMessage="no_species_found"
      traits={traits}
    />,
  );

const listOptions = () => mockUseList.mock.calls.at(-1)![0];

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

it("offers to clear the filters, not just the search, when nothing matches", async () => {
  const onClearTraits = jest.fn();
  await render(
    <TaxonChildrenList
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
