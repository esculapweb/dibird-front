jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/language-context", () => ({
  useLanguage: () => ({ language: "en" }),
}));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => <Text>{`icon-${name}`}</Text>,
  };
});
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));
jest.mock("../../../hooks/useDropdownQuery", () => ({
  useDropdownQuery: jest.fn(),
}));
jest.mock("../../../util/fetches", () => ({
  fetchTraitFilters: jest.fn(),
  fetchMyCountries: jest.fn(),
}));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { useQuery } from "@tanstack/react-query";
import { useDropdownQuery } from "../../../hooks/useDropdownQuery";
import TaxonFilterChips from "../TaxonFilterChips";
import { TaxonTraitFilters } from "../../../types";

const mockUseQuery = useQuery as jest.Mock;
const mockUseDropdownQuery = useDropdownQuery as jest.Mock;

const OPTIONS = {
  mass: { units: "g", min: 1.9, max: 109250 },
  clutch: { units: "eggs", min: 1, max: 35 },
  habitat: [
    { value: "Forest", label: "Forest", count: 6089 },
    { value: "Marine", label: "Marine", count: 312 },
  ],
  migration: [],
  trophic_level: [],
  trophic_niche: [],
};

const mockOnChange = jest.fn();

const renderChips = (traits: TaxonTraitFilters) =>
  render(<TaxonFilterChips traits={traits} onChange={mockOnChange} />);

beforeEach(() => {
  jest.clearAllMocks();
  mockUseQuery.mockReturnValue({ data: OPTIONS });
  mockUseDropdownQuery.mockReturnValue({
    query: { data: new Map<number, string>([[5, "France"]]) },
    sort: "name",
    onSortChange: jest.fn(),
  });
});

it("labels a chip per active filter — country, mass bucket, habitat", async () => {
  await renderChips({ territory: 5, mass_min: 1000, habitat: ["Forest"] });

  expect(screen.getByText("France")).toBeOnTheScreen();
  expect(screen.getByText("mass_large")).toBeOnTheScreen();
  expect(screen.getByText("Forest")).toBeOnTheScreen();
});

it("renders nothing when no filters are active", async () => {
  await renderChips({});

  expect(screen.queryByTestId("remove-taxon-filter-territory")).toBeNull();
});

it("drops both mass bounds when the mass chip is removed", async () => {
  await renderChips({ territory: 5, mass_min: 1000, habitat: ["Forest"] });

  await fireEvent.press(screen.getByTestId("remove-taxon-filter-mass"));

  expect(mockOnChange).toHaveBeenCalledWith({
    territory: 5,
    habitat: ["Forest"],
  });
});

it("drops the country when its chip is removed", async () => {
  await renderChips({ territory: 5, mass_min: 1000 });

  await fireEvent.press(screen.getByTestId("remove-taxon-filter-territory"));

  expect(mockOnChange).toHaveBeenCalledWith({ mass_min: 1000 });
});
