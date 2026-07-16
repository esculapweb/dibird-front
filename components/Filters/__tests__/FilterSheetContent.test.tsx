jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@gorhom/bottom-sheet", () => {
  const { ScrollView } = require("react-native");
  return { BottomSheetScrollView: ScrollView };
});
jest.mock("../../../util/fetches", () => ({
  fetchMyCountries: jest.fn(),
  fetchMyPlaces: jest.fn(),
  fetchSpecies: jest.fn(),
}));
jest.mock("../../../store/language-context", () => ({ useLanguage: jest.fn() }));
jest.mock("../../../store/location-context", () => ({ useLocation: jest.fn() }));
jest.mock("../../../store/filters-context", () => ({ useFilters: jest.fn() }));
jest.mock("../../../hooks/useDropdownQuery", () => ({ useDropdownQuery: jest.fn() }));
jest.mock("../../../hooks/useLocationUnavailable", () => ({
  useLocationUnavailable: () => mockHandleLocationUnavailable,
}));
jest.mock("../../ui/SpeciesOptionRow", () => ({ __esModule: true, default: () => null }));

const mockDropdownCapture = jest.fn();
jest.mock("../../ui/DropdownInput", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockDropdownCapture(props);
    return null;
  },
}));
const mockRadioGroupCapture = jest.fn();
jest.mock("../../ui/RadioGroup", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockRadioGroupCapture(props);
    return null;
  },
}));
const mockDateRangeFilterCapture = jest.fn();
jest.mock("../../ui/DateRangeFilter", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockDateRangeFilterCapture(props);
    return null;
  },
}));
const mockSearchInputCapture = jest.fn();
jest.mock("../../ui/SearchInput", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockSearchInputCapture(props);
    return null;
  },
}));

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useLanguage } from "../../../store/language-context";
import { useLocation } from "../../../store/location-context";
import { useFilters } from "../../../store/filters-context";
import { useDropdownQuery } from "../../../hooks/useDropdownQuery";
import FilterSheetContent from "../FilterSheetContent";
import { AllowedFilterKey, Filters } from "../../../types";

const mockHandleLocationUnavailable = jest.fn();
const mockSetFilters = jest.fn();
const mockDismiss = jest.fn();
const mockOnSearchChange = jest.fn();
const mockSetTerritory = jest.fn().mockResolvedValue(undefined);
const mockSetDate = jest.fn().mockResolvedValue(undefined);
const mockSetPlace = jest.fn().mockResolvedValue(undefined);
const mockSetSpecies = jest.fn().mockResolvedValue(undefined);
const mockRequestLocation = jest.fn();

const queriesByType: Record<string, { data: unknown[] }> = {};
const onSortChangeByType: Record<string, jest.Mock> = {};

const ALL_ALLOWED: AllowedFilterKey[] = ["territory", "place", "species", "date", "favourite"];

interface CapturedDropdownProps {
  type: string;
  value: number | null;
  setValue: (v: number | null) => void;
  disabled?: boolean;
}

const dropdownPropsByType = (type: string) =>
  mockDropdownCapture.mock.calls
    .map((c) => c[0] as CapturedDropdownProps)
    .filter((p) => p.type === type)
    .at(-1)!;

const dateRangeProps = () => mockDateRangeFilterCapture.mock.calls.at(-1)![0] as {
  setDateFilter: (v: unknown) => void;
};

const baseProps = (overrides: Record<string, unknown> = {}) => ({
  filters: {} as Filters,
  allowed: ALL_ALLOWED,
  setFilters: mockSetFilters,
  dismiss: mockDismiss,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  (useLanguage as jest.Mock).mockReturnValue({ language: "en" });
  (useLocation as jest.Mock).mockReturnValue({
    locationCoords: null,
    locationAvailable: false,
    permissionStatus: "undetermined",
    requestLocation: mockRequestLocation,
  });
  (useFilters as jest.Mock).mockReturnValue({
    setTerritory: mockSetTerritory,
    date: null,
    setDate: mockSetDate,
    setPlace: mockSetPlace,
    setSpecies: mockSetSpecies,
  });

  queriesByType.CountriesDropdown = { data: [{ value: 5, label: "France" }] };
  queriesByType.PlacesDropdown = { data: [] };
  queriesByType.SpeciesDropdown = { data: [{ value: 3, label: "Blue Tit" }] };
  onSortChangeByType.CountriesDropdown = jest.fn();
  onSortChangeByType.PlacesDropdown = jest.fn();
  onSortChangeByType.SpeciesDropdown = jest.fn();

  (useDropdownQuery as jest.Mock).mockImplementation(({ type, enabled }: { type: string; enabled?: boolean }) => ({
    query: enabled === false ? { data: undefined } : queriesByType[type],
    sort: `${type}-sort`,
    onSortChange: onSortChangeByType[type],
  }));
});

describe("field visibility by `allowed`", () => {
  it("renders a DropdownInput per allowed dropdown key, RadioGroup for favourite, DateRangeFilter for date", async () => {
    await render(<FilterSheetContent {...baseProps()} />);
    expect(mockDropdownCapture).toHaveBeenCalledTimes(3);
    expect(mockRadioGroupCapture).toHaveBeenCalledTimes(1);
    expect(mockDateRangeFilterCapture).toHaveBeenCalledTimes(1);
  });

  it("omits fields not in `allowed`", async () => {
    await render(<FilterSheetContent {...baseProps({ allowed: ["territory"] as AllowedFilterKey[] })} />);
    expect(mockDropdownCapture).toHaveBeenCalledTimes(1);
    expect(dropdownPropsByType("CountriesDropdown")).toBeTruthy();
    expect(mockRadioGroupCapture).not.toHaveBeenCalled();
    expect(mockDateRangeFilterCapture).not.toHaveBeenCalled();
  });

  it("shows the search input only when showSearch is set", async () => {
    await render(<FilterSheetContent {...baseProps()} showSearch />);
    expect(mockSearchInputCapture).toHaveBeenCalledTimes(1);

    mockSearchInputCapture.mockClear();
    await render(<FilterSheetContent {...baseProps()} />);
    expect(mockSearchInputCapture).not.toHaveBeenCalled();
  });
});

describe("initial state seeded from `filters`", () => {
  it("seeds territory/place/species/favourite values", async () => {
    await render(
      <FilterSheetContent
        {...baseProps({ filters: { territory: 5, place: 9, species: 3, favourite: true } })}
      />,
    );
    expect(dropdownPropsByType("CountriesDropdown").value).toBe(5);
    expect(dropdownPropsByType("PlacesDropdown").value).toBe(9);
    expect(dropdownPropsByType("SpeciesDropdown").value).toBe(3);
    expect(mockRadioGroupCapture).toHaveBeenCalledWith(
      expect.objectContaining({ value: true }),
    );
  });
});

describe("effectiveTerritory / query gating", () => {
  it("uses extraTerritory instead of the local value when territory isn't allowed", async () => {
    await render(
      <FilterSheetContent
        {...baseProps({ allowed: ["place"] as AllowedFilterKey[], extraTerritory: 7 })}
      />,
    );
    expect(dropdownPropsByType("PlacesDropdown").disabled).toBeFalsy();
  });

  it("disables the place/species dropdowns until a territory is chosen", async () => {
    await render(<FilterSheetContent {...baseProps()} />);
    expect(dropdownPropsByType("PlacesDropdown").disabled).toBe(true);
    expect(dropdownPropsByType("SpeciesDropdown").disabled).toBe(true);
  });

  it("enables place/species once a territory is selected", async () => {
    await render(<FilterSheetContent {...baseProps({ filters: { territory: 5 } })} />);
    expect(dropdownPropsByType("PlacesDropdown").disabled).toBeFalsy();
    expect(dropdownPropsByType("SpeciesDropdown").disabled).toBeFalsy();
  });
});

describe("territory change resets place/species", () => {
  it("does not reset on the initial mount even if a territory is already set", async () => {
    await render(<FilterSheetContent {...baseProps({ filters: { territory: 5, place: 9, species: 3 } })} />);
    expect(dropdownPropsByType("PlacesDropdown").value).toBe(9);
    expect(dropdownPropsByType("SpeciesDropdown").value).toBe(3);
  });

  it("resets place/species once the territory dropdown value actually changes", async () => {
    await render(<FilterSheetContent {...baseProps({ filters: { territory: 5, place: 9, species: 3 } })} />);
    expect(dropdownPropsByType("PlacesDropdown").value).toBe(9);

    await act(async () => {
      dropdownPropsByType("CountriesDropdown").setValue(6);
    });

    expect(dropdownPropsByType("PlacesDropdown").value).toBeNull();
    expect(dropdownPropsByType("SpeciesDropdown").value).toBeNull();
  });
});

describe("stale species correction", () => {
  it("clears speciesValue once it's no longer present in the species dropdown data", async () => {
    queriesByType.SpeciesDropdown = { data: [{ value: 99, label: "Other" }] };
    await render(<FilterSheetContent {...baseProps({ filters: { territory: 5, species: 3 } })} />);
    expect(dropdownPropsByType("SpeciesDropdown").value).toBeNull();
  });

  it("keeps speciesValue when it's still present in the data", async () => {
    await render(<FilterSheetContent {...baseProps({ filters: { territory: 5, species: 3 } })} />);
    expect(dropdownPropsByType("SpeciesDropdown").value).toBe(3);
  });
});

describe("applyHandler", () => {
  it("builds newFilters from only the allowed keys and applies/dismisses", async () => {
    await render(
      <FilterSheetContent
        {...baseProps({ allowed: ["territory", "place"] as AllowedFilterKey[], filters: { territory: 5, place: 9 } })}
      />,
    );

    await fireEvent.press(screen.getByText("apply"));

    expect(mockSetFilters).toHaveBeenCalledWith({ territory: 5, place: 9 });
    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });

  it("includes an active date filter, but undefined for an inactive one", async () => {
    mockDateRangeFilterCapture.mockClear();
    await render(<FilterSheetContent {...baseProps({ allowed: ["date"] as AllowedFilterKey[] })} />);

    await act(async () => {
      dateRangeProps().setDateFilter({ type: "today" });
    });
    await fireEvent.press(screen.getByText("apply"));
    expect(mockSetFilters).toHaveBeenCalledWith({ date: { type: "today" } });

    mockSetFilters.mockClear();
    await render(<FilterSheetContent {...baseProps({ allowed: ["date"] as AllowedFilterKey[] })} />);
    await fireEvent.press(screen.getByText("apply"));
    expect(mockSetFilters).toHaveBeenCalledWith({ date: undefined });
  });

  it("propagates the new territory to context, resetting place/species when it changed", async () => {
    await render(
      <FilterSheetContent
        {...baseProps({ filters: { territory: 5, place: 9, species: 3 } })}
      />,
    );
    await act(async () => {
      dropdownPropsByType("CountriesDropdown").setValue(6);
    });

    await fireEvent.press(screen.getByText("apply"));

    expect(mockSetTerritory).toHaveBeenCalledWith(6);
    expect(mockSetPlace).toHaveBeenCalledWith(null);
    expect(mockSetSpecies).toHaveBeenCalledWith(null);
  });

  it("does not force-reset place/species in context when the territory is unchanged", async () => {
    await render(
      <FilterSheetContent {...baseProps({ filters: { territory: 5, place: 9, species: 3 } })} />,
    );
    await fireEvent.press(screen.getByText("apply"));

    expect(mockSetTerritory).toHaveBeenCalledWith(5);
    // place/species still get propagated (their own allowed branches), but
    // not because of a territory-changed reset — just their own current value.
    expect(mockSetPlace).toHaveBeenCalledWith(9);
    expect(mockSetSpecies).toHaveBeenCalledWith(3);
  });

  it("skips propagating species to context when extraTerritory is set", async () => {
    await render(
      <FilterSheetContent
        {...baseProps({ allowed: ["species"] as AllowedFilterKey[], extraTerritory: 5, filters: { species: 3 } })}
      />,
    );
    await fireEvent.press(screen.getByText("apply"));
    expect(mockSetSpecies).not.toHaveBeenCalled();
  });
});

describe("search wiring", () => {
  it("seeds localSearch from initialSearch, and forwards changes/clear via onSearchChange", async () => {
    await render(
      <FilterSheetContent {...baseProps()} showSearch initialSearch="robin" onSearchChange={mockOnSearchChange} />,
    );
    expect(mockSearchInputCapture).toHaveBeenCalledWith(
      expect.objectContaining({ value: "robin" }),
    );

    const props = mockSearchInputCapture.mock.calls.at(-1)![0];
    await act(async () => props.onChange("wren"));
    expect(mockOnSearchChange).toHaveBeenCalledWith("wren");

    await act(async () => props.onClear());
    expect(mockOnSearchChange).toHaveBeenCalledWith("");
  });
});
