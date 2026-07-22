jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => <Text>{`icon-${name}`}</Text>,
  };
});
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
}));
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));
jest.mock("../../../util/fetches", () => ({ fetchSpeciesCount: jest.fn() }));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { useQuery } from "@tanstack/react-query";
import { createNavigationMock } from "../../../screens/test-utils";
import CatalogCard from "../CatalogCard";

const mockNavigation = createNavigationMock();
const mockUseQuery = useQuery as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseQuery.mockReturnValue({ data: 11250 });
});

it("opens the order tree when the card itself is tapped", async () => {
  await render(<CatalogCard />);

  await fireEvent.press(screen.getByTestId("catalog-card"));
  expect(mockNavigation.navigate).toHaveBeenCalledWith("Taxonomy", { rank: 2 });
});

it("goes straight to searching species by name", async () => {
  await render(<CatalogCard />);

  await fireEvent.press(screen.getByTestId("catalog-card-search"));
  expect(mockNavigation.navigate).toHaveBeenCalledWith("Taxonomy", {
    rank: 5,
    title: "all_species",
    focusSearch: true,
  });
});

it("opens the comparison screen with no species preselected", async () => {
  await render(<CatalogCard />);

  await fireEvent.press(screen.getByTestId("catalog-card-compare"));
  expect(mockNavigation.navigate).toHaveBeenCalledWith(
    "SpeciesCompare",
    undefined,
  );
});

it("shows how many species the catalogue holds", async () => {
  await render(<CatalogCard />);

  expect(
    screen.getByText('species_catalog_count:{"count":11250}'),
  ).toBeOnTheScreen();
});

it("still renders while the count is unknown", async () => {
  mockUseQuery.mockReturnValue({ data: undefined });

  await render(<CatalogCard />);

  expect(screen.getByText("species_catalog")).toBeOnTheScreen();
  expect(screen.queryByText(/species_catalog_count/)).toBeNull();
});
