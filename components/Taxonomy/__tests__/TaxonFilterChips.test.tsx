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
const mockOnEdit = jest.fn();

const renderChips = (traits: TaxonTraitFilters, onEdit?: jest.Mock) =>
  render(
    <TaxonFilterChips
      traits={traits}
      onChange={mockOnChange}
      onEdit={onEdit}
    />,
  );

// The group lists, by rank, as useTaxonGroupOptions asks for them.
const GROUP_OPTIONS: Record<number, { value: string; label: string }[]> = {
  2: [{ value: "perching-birds", label: "Perching birds" }],
  3: [{ value: "tyrant-flycatchers", label: "Tyrant flycatchers" }],
  4: [{ value: "pitangus", label: "Pitangus" }],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseQuery.mockImplementation(({ queryKey }: { queryKey: unknown[] }) =>
    queryKey[0] === "TaxonGroupOptions"
      ? { data: GROUP_OPTIONS[queryKey[1] as number] }
      : { data: OPTIONS },
  );
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

it("asks the host to edit the group when the chip itself is pressed", async () => {
  await renderChips({ mass_min: 1000, habitat: ["Forest"] }, mockOnEdit);

  await fireEvent.press(screen.getByTestId("edit-taxon-filter-habitat"));

  expect(mockOnEdit).toHaveBeenCalledWith("habitat");
  expect(mockOnChange).not.toHaveBeenCalled();
});

it("removes rather than edits when the close icon is pressed", async () => {
  await renderChips({ territory: 5, mass_min: 1000 }, mockOnEdit);

  await fireEvent.press(screen.getByTestId("remove-taxon-filter-territory"));

  expect(mockOnChange).toHaveBeenCalledWith({ mass_min: 1000 });
  expect(mockOnEdit).not.toHaveBeenCalled();
});

describe("taxonomic group", () => {
  const GROUP = {
    order: "perching-birds",
    family: "tyrant-flycatchers",
    genus: "pitangus",
  };

  it("names each picked level on a chip of its own", async () => {
    await renderChips(GROUP);

    expect(screen.getByText("Perching birds")).toBeOnTheScreen();
    expect(screen.getByText("Tyrant flycatchers")).toBeOnTheScreen();
    expect(screen.getByText("Pitangus")).toBeOnTheScreen();
  });

  it("drops just that level when its chip is removed", async () => {
    // The family alone still says which birds these are.
    await renderChips(GROUP);

    await fireEvent.press(screen.getByTestId("remove-taxon-filter-order"));

    expect(mockOnChange).toHaveBeenCalledWith({
      family: "tyrant-flycatchers",
      genus: "pitangus",
    });
  });

  it("holds a placeholder until the group's list is in", async () => {
    mockUseQuery.mockImplementation(({ queryKey }: { queryKey: unknown[] }) =>
      queryKey[0] === "TaxonGroupOptions" ? { data: undefined } : { data: OPTIONS },
    );

    await renderChips({ order: "perching-birds" });

    expect(screen.getByText("…")).toBeOnTheScreen();
  });
});
