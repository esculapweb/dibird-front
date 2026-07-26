jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("../../../store/language-context", () => ({
  useLanguage: () => ({ language: "en" }),
}));
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
}));
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));
jest.mock("../../../util/fetches", () => ({ fetchTerritoryTree: jest.fn() }));
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
jest.mock("../../Stats/ChecklistCard", () => {
  const { Pressable, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({
      item,
      onPress,
      personal,
    }: {
      item: { name_lang: string; type: string };
      onPress: () => void;
      personal?: boolean;
    }) => (
      <Pressable testID={`row-${item.type}`} onPress={onPress}>
        <Text>{item.name_lang}</Text>
        <Text testID={`personal-${item.name_lang}`}>{String(personal)}</Text>
      </Pressable>
    ),
  };
});

import { ReactElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { useQuery } from "@tanstack/react-query";
import { createNavigationMock } from "../../../screens/test-utils";
import TerritoryChecklist from "../TerritoryChecklist";
import { fetchTerritoryTree } from "../../../util/fetches";
import { ChecklistItem } from "../../../types";

let mockItemsListProps: Record<string, unknown>;
const mockNavigation = createNavigationMock();
const mockUseQuery = useQuery as jest.Mock;
const mockFetchTerritoryTree = fetchTerritoryTree as jest.Mock;

const group = (
  type: "order" | "family",
  id: number,
  name: string,
): ChecklistItem => ({
  type,
  id,
  name_lang: name,
  latin: `${name}-latin`,
  segment: "",
  seen: false,
  status: null,
  thumb: null,
  total: 2,
  seen_count: 1,
});

const species = (
  id: number,
  name: string,
  latin: string,
  seen = false,
): ChecklistItem => ({
  type: "species",
  species_id: id,
  name_lang: name,
  latin,
  segment: name.toLowerCase().replace(/ /g, "-"),
  seen,
  status: "LC",
  thumb: null,
});

// The shape fetchTerritoryTree hands back: a flat list where each group header
// is followed by what belongs under it.
const ROWS: ChecklistItem[] = [
  group("order", 1, "Rheas order"),
  group("family", 2, "Rheas family"),
  species(10, "Greater Rhea", "Rhea americana", true),
  species(11, "Lesser Rhea", "Rhea pennata"),
  group("order", 3, "Condors order"),
  group("family", 4, "Condors family"),
  species(12, "Andean Condor", "Vultur gryphus"),
];

const queryResult = (overrides: Record<string, unknown> = {}) => ({
  data: ROWS,
  isLoading: false,
  isError: false,
  isRefetching: false,
  error: null,
  refetch: jest.fn(),
  ...overrides,
});

const rows = () => mockItemsListProps.data as ChecklistItem[];

const renderRow = (item: ChecklistItem, index = 0) =>
  render(
    (
      mockItemsListProps.renderItem as (arg: {
        item: ChecklistItem;
        index: number;
      }) => ReactElement
    )({ item, index }),
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockUseQuery.mockReturnValue(queryResult());
});

// The public endpoint, not /myapi/checklist2/: the country page is open to
// guests, and its personal half is off anyway (see fetchTerritoryTree).
it("asks the public catalogue endpoint for that country", async () => {
  await render(<TerritoryChecklist idAvibase={52} />);
  await (mockUseQuery.mock.calls.at(-1)![0].queryFn as () => unknown)();

  expect(mockUseQuery.mock.calls.at(-1)![0].queryKey).toEqual([
    "TerritoryChecklist",
    52,
    "en",
  ]);
  expect(mockFetchTerritoryTree).toHaveBeenCalledWith(52);
});

it("keeps the order and family headers with the species under them", async () => {
  await render(<TerritoryChecklist idAvibase={52} />);

  expect(rows().map((r) => r.type)).toEqual([
    "order",
    "family",
    "species",
    "species",
    "order",
    "family",
    "species",
  ]);
});

it("leaves the personal half of the checklist card switched off", async () => {
  // The country page is the catalogue: a "seen" checkbox here would answer
  // "seen" without saying over what period.
  await render(<TerritoryChecklist idAvibase={52} />);
  await renderRow(ROWS[2]);

  expect(screen.getByTestId("personal-Greater Rhea")).toHaveTextContent("false");
});

it("filters locally and drops the headers left with nothing under them", async () => {
  // The whole country arrives in one page, so search never hits the network.
  await render(<TerritoryChecklist idAvibase={52} />);

  await fireEvent.changeText(screen.getByTestId("search-input"), "condor");

  expect(rows().map((r) => r.name_lang)).toEqual([
    "Condors order",
    "Condors family",
    "Andean Condor",
  ]);
});

it("matches the latin name too", async () => {
  await render(<TerritoryChecklist idAvibase={52} />);

  await fireEvent.changeText(screen.getByTestId("search-input"), "pennata");

  expect(rows().map((r) => r.name_lang)).toEqual([
    "Rheas order",
    "Rheas family",
    "Lesser Rhea",
  ]);
});

it("drops every header when nothing matches at all", async () => {
  await render(<TerritoryChecklist idAvibase={52} />);

  await fireEvent.changeText(screen.getByTestId("search-input"), "penguin");

  expect(rows()).toEqual([]);
  expect(mockItemsListProps.emptyType).toBe("filtered");
});

it("opens the species page from a row", async () => {
  await render(<TerritoryChecklist idAvibase={52} />);
  await renderRow(ROWS[2]);

  await fireEvent.press(screen.getByTestId("row-species"));

  expect(mockNavigation.navigate).toHaveBeenCalledWith("SpeciesDetail", {
    segment: "greater-rhea",
  });
});

it("keys the rows so a group and a species can share an id", async () => {
  await render(<TerritoryChecklist idAvibase={52} />);
  const keyOf = mockItemsListProps.keyExtractor as (
    item: ChecklistItem,
    index: number,
  ) => string;

  expect(keyOf(ROWS[0], 0)).not.toBe(keyOf(ROWS[1], 1));
});

it("offers a retry when the checklist could not be loaded", async () => {
  const result = queryResult({
    data: undefined,
    isError: true,
    error: new Error("boom"),
  });
  mockUseQuery.mockReturnValue(result);

  await render(<TerritoryChecklist idAvibase={52} />);
  expect(screen.getByText("checklist_unavailable")).toBeOnTheScreen();

  await fireEvent.press(screen.getByText("try_again"));
  expect(result.refetch).toHaveBeenCalled();
});

it("keeps an order whose other family still has matches", async () => {
  // Two families under one order: only the second one survives the search, so
  // the order header has to stay while the first family goes.
  mockUseQuery.mockReturnValue(
    queryResult({
      data: [
        group("order", 1, "Hawks order"),
        group("family", 2, "Ospreys"),
        species(20, "Osprey", "Pandion haliaetus"),
        group("family", 3, "Eagles"),
        species(21, "Golden Eagle", "Aquila chrysaetos"),
      ],
    }),
  );

  await render(<TerritoryChecklist idAvibase={52} />);
  await fireEvent.changeText(screen.getByTestId("search-input"), "eagle");

  expect(rows().map((r) => r.name_lang)).toEqual([
    "Hawks order",
    "Eagles",
    "Golden Eagle",
  ]);
});
