jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => <Text>{`icon-${name}`}</Text>,
  };
});
jest.mock("@gorhom/bottom-sheet", () => {
  const { ScrollView } = require("react-native");
  return { BottomSheetScrollView: ScrollView };
});
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));
jest.mock("../../../util/fetches", () => ({ fetchTraitFilters: jest.fn() }));
jest.mock("../../../store/language-context", () => ({
  useLanguage: () => ({ language: "en" }),
}));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { useQuery } from "@tanstack/react-query";
import TaxonFilterSheet, { hasTraitFilters } from "../TaxonFilterSheet";
import { TaxonTraitFilters } from "../../../types";

const mockUseQuery = useQuery as jest.Mock;
const mockOnApply = jest.fn();
const mockDismiss = jest.fn();

const OPTIONS = {
  mass: { units: "g", min: 1.9, max: 109250 },
  clutch: { units: "eggs", min: 1, max: 35 },
  habitat: [
    { value: "Forest", label: "Forest", count: 6089 },
    { value: "Marine", label: "Marine", count: 312 },
  ],
  migration: [{ value: "Sedentary", label: "Sedentary", count: 7000 }],
  trophic_level: [{ value: "Carnivore", label: "Carnivore", count: 1200 }],
  trophic_niche: [],
};

const renderSheet = (value: TaxonTraitFilters = {}) =>
  render(
    <TaxonFilterSheet
      value={value}
      onApply={mockOnApply}
      dismiss={mockDismiss}
    />,
  );

// Groups start folded away, so a test that wants the chips has to open one.
const openGroup = (id: string) =>
  fireEvent.press(screen.getByTestId(`filter-group-${id}`));

beforeEach(() => {
  jest.clearAllMocks();
  mockUseQuery.mockReturnValue({ data: OPTIONS, isLoading: false });
});

it("starts with every group folded, showing one row each instead of 36 chips", async () => {
  await renderSheet();

  expect(screen.getByText("habitat")).toBeOnTheScreen();
  expect(screen.queryByText("Forest")).toBeNull();
  expect(screen.queryByText("mass_large")).toBeNull();
});

it("carries its own title and reset, so the sheet has a single measured node", async () => {
  // The shared title block is a second BottomSheetView, and with dynamic
  // sizing whichever node reports last decides the sheet's height.
  await renderSheet({ mass_min: 1000 });

  expect(screen.getByText("filters")).toBeOnTheScreen();
  await fireEvent.press(screen.getByText("reset_filters"));
  await fireEvent.press(screen.getByText("apply"));

  expect(mockOnApply).toHaveBeenCalledWith({});
});

it("offers no reset while nothing is selected", async () => {
  await renderSheet();

  expect(screen.queryByText("reset_filters")).toBeNull();
});

it("offers the vocabularies the API reports, with their species counts", async () => {
  await renderSheet();

  await openGroup("habitat");

  expect(screen.getByText("Forest")).toBeOnTheScreen();
  expect(screen.getByText("6089")).toBeOnTheScreen();
});

it("keeps a single group open, so the sheet never grows past a screenful", async () => {
  await renderSheet();

  await openGroup("habitat");
  await openGroup("migration");

  expect(screen.getByText("Sedentary")).toBeOnTheScreen();
  expect(screen.queryByText("Forest")).toBeNull();
});

it("shows what is selected on the folded row", async () => {
  await renderSheet({ habitat: ["Forest", "Marine"], mass_min: 1000 });

  expect(screen.getByText("Forest, Marine")).toBeOnTheScreen();
  expect(screen.getByText("mass_large")).toBeOnTheScreen();
});

it("hides a vocabulary the API has no values for", async () => {
  await renderSheet();

  expect(screen.queryByText("trophic_niche")).toBeNull();
  expect(screen.getByText("habitat")).toBeOnTheScreen();
});

it("turns a mass bucket into the range the API expects", async () => {
  await renderSheet();
  await openGroup("mass");

  await fireEvent.press(screen.getByText("mass_large"));
  await fireEvent.press(screen.getByText("apply"));

  expect(mockOnApply).toHaveBeenCalledWith({ mass_min: 1000 });
  expect(mockDismiss).toHaveBeenCalled();
});

it("keeps only one bucket per trait — picking another replaces the range", async () => {
  await renderSheet();
  await openGroup("mass");

  await fireEvent.press(screen.getByText("mass_tiny"));
  await fireEvent.press(screen.getByText("mass_small"));
  await fireEvent.press(screen.getByText("apply"));

  expect(mockOnApply).toHaveBeenCalledWith({ mass_min: 20, mass_max: 100 });
});

it("lets a bucket be tapped again to drop it", async () => {
  await renderSheet();
  await openGroup("clutch");

  await fireEvent.press(screen.getByText("clutch_large"));
  // The folded row now echoes the choice, so the chip is the second match.
  await fireEvent.press(screen.getAllByText("clutch_large")[1]);
  await fireEvent.press(screen.getByText("apply"));

  expect(mockOnApply).toHaveBeenCalledWith({});
});

it("collects several values of the same vocabulary", async () => {
  await renderSheet();
  await openGroup("habitat");

  await fireEvent.press(screen.getByText("Forest"));
  await fireEvent.press(screen.getByText("Marine"));
  await fireEvent.press(screen.getByText("apply"));

  expect(mockOnApply).toHaveBeenCalledWith({ habitat: ["Forest", "Marine"] });
});

it("starts from the filters already applied", async () => {
  await renderSheet({ habitat: ["Marine"] });
  await openGroup("habitat");

  await fireEvent.press(screen.getByText("Forest"));
  await fireEvent.press(screen.getByText("apply"));

  expect(mockOnApply).toHaveBeenCalledWith({ habitat: ["Marine", "Forest"] });
});

describe("hasTraitFilters", () => {
  it("ignores empty selections and unset ranges", () => {
    expect(hasTraitFilters({})).toBe(false);
    expect(hasTraitFilters({ habitat: [], mass_min: null })).toBe(false);
  });

  it("reports a filter as soon as anything is chosen", () => {
    expect(hasTraitFilters({ mass_min: 1000 })).toBe(true);
    expect(hasTraitFilters({ habitat: ["Forest"] })).toBe(true);
  });
});
