jest.mock("../../../store/theme-context", () => ({
  useTheme: () => ({
    Colors: {
      textMain: "#000",
      textSecondary: "#666",
      primary300: "#eee",
      border: "#ccc",
    },
  }),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("@expo/vector-icons", () => {
  const { View } = require("react-native");
  return { Ionicons: View };
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

const mockDropdownCapture = jest.fn();
jest.mock("../../ui/DropdownInput", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockDropdownCapture(props);
    return null;
  },
}));
const mockDateInputCapture = jest.fn();
jest.mock("../../ui/DateInput", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockDateInputCapture(props);
    return null;
  },
}));
const mockTimeInputCapture = jest.fn();
jest.mock("../../ui/TimeInput", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockTimeInputCapture(props);
    return null;
  },
}));
const mockInputCapture = jest.fn();
jest.mock("../../ui/Input", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockInputCapture(props);
    return null;
  },
}));
const mockSectionCapture = jest.fn();
jest.mock("../../ui/Section", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: (props: { title: string; children: import("react").ReactNode }) => {
      mockSectionCapture(props);
      return <View>{props.children}</View>;
    },
  };
});
const mockPrivacyToggleCapture = jest.fn();
jest.mock("../../ui/PrivacyToggle", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockPrivacyToggleCapture(props);
    return null;
  },
}));
const mockPlaceBlockCapture = jest.fn();
jest.mock("../../Place/PlaceBlock", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockPlaceBlockCapture(props);
    return null;
  },
}));
const mockPhotoPickerCapture = jest.fn();
jest.mock("../ObservationPhotoPicker", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockPhotoPickerCapture(props);
    return null;
  },
}));
jest.mock("../../ui/SpeciesOptionRow", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ disabled }: { disabled?: boolean }) => <Text>{disabled ? "disabled" : "enabled"}</Text>,
  };
});

import { render, fireEvent, screen } from "@testing-library/react-native";
import { useLanguage } from "../../../store/language-context";
import { useLocation } from "../../../store/location-context";
import { useFilters } from "../../../store/filters-context";
import { useDropdownQuery } from "../../../hooks/useDropdownQuery";
import ObservationForm from "../ObservationForm";

const mockHandleLocationUnavailable = jest.fn();
const mockSetFormData = jest.fn();
const mockSetErrors = jest.fn();
const mockSetTerritoryValue = jest.fn();
const mockSetPlaceValue = jest.fn();
const mockSetSpeciesValue = jest.fn();
const mockSetSpeciesData = jest.fn();
const mockSetPlaceData = jest.fn();
const mockOnAddNewPlace = jest.fn();
const mockOnEditDiary = jest.fn();
const mockRequestLocation = jest.fn();

const queriesByType: Record<string, { data: unknown[] }> = {};
const onSortChangeByType: Record<string, jest.Mock> = {};

const BASE_FORM_DATA = {
  date_time: "2026-01-01",
  private: false,
  location_private: true,
  time: null as string | null,
  quantity: null as number | null,
  notes: null as string | null,
};

const mockOnPickPhotos = jest.fn();
const mockOnRemovePhoto = jest.fn();

const baseProps = () => ({
  formData: BASE_FORM_DATA as never,
  setFormData: mockSetFormData,
  errors: {},
  setErrors: mockSetErrors,
  territoryValue: 5,
  setTerritoryValue: mockSetTerritoryValue,
  placeValue: null,
  setPlaceValue: mockSetPlaceValue,
  onAddNewPlace: mockOnAddNewPlace,
  placeData: null,
  setPlaceData: mockSetPlaceData,
  speciesValue: null,
  setSpeciesValue: mockSetSpeciesValue,
  speciesData: null,
  setSpeciesData: mockSetSpeciesData,
  onEditDiary: mockOnEditDiary,
  existingSpecies: new Set<number>(),
  photos: [],
  onPickPhotos: mockOnPickPhotos,
  onRemovePhoto: mockOnRemovePhoto,
});

const dropdownProps = (type: string) =>
  mockDropdownCapture.mock.calls.map((c) => c[0]).reverse().find((p) => p.type === type);

beforeEach(() => {
  jest.clearAllMocks();
  (useLanguage as jest.Mock).mockReturnValue({ language: "en" });
  (useLocation as jest.Mock).mockReturnValue({
    locationCoords: null,
    locationAvailable: false,
    permissionStatus: "undetermined",
    requestLocation: mockRequestLocation,
  });
  (useFilters as jest.Mock).mockReturnValue({ date: undefined });

  queriesByType.CountriesDropdown = { data: [{ value: 5, label: "France" }] };
  queriesByType.PlacesDropdown = { data: [] };
  queriesByType.SpeciesDropdown = { data: [{ value: 9, label: "Robin" }] };
  onSortChangeByType.CountriesDropdown = jest.fn();
  onSortChangeByType.PlacesDropdown = jest.fn();
  onSortChangeByType.SpeciesDropdown = jest.fn();

  (useDropdownQuery as jest.Mock).mockImplementation(({ type }: { type: string }) => ({
    query: queriesByType[type],
    sort: `${type}-sort`,
    onSortChange: onSortChangeByType[type],
  }));
});

describe("territory dropdown", () => {
  it("updates territoryValue/formData, clears the territory error, and resets the place on selection", async () => {
    await render(<ObservationForm {...baseProps()} />);
    const props = dropdownProps("CountriesDropdown");
    props.setValue(7);

    expect(mockSetTerritoryValue).toHaveBeenCalledWith(7);
    expect(mockSetFormData).toHaveBeenCalled();
    expect(mockSetFormData.mock.calls[0][0]({ territory: 1 })).toEqual({ territory: 7 });
    expect(mockSetErrors).toHaveBeenCalled();
    expect(mockSetErrors.mock.calls[0][0]({ territory: "required" })).toEqual({ territory: undefined });
    expect(mockSetPlaceValue).toHaveBeenCalledWith(null);
  });

  it("is hidden entirely in diary mode", async () => {
    await render(<ObservationForm {...baseProps()} isDiaryMode />);
    expect(dropdownProps("CountriesDropdown")).toBeUndefined();
  });
});

describe("species dropdown", () => {
  it("is disabled without a territory", async () => {
    await render(<ObservationForm {...baseProps()} territoryValue={null} />);
    expect(dropdownProps("SpeciesDropdown").disabled).toBe(true);
  });

  it("updates speciesValue/formData/speciesData and clears the species error on selection", async () => {
    await render(<ObservationForm {...baseProps()} />);
    const props = dropdownProps("SpeciesDropdown");
    props.setValue(9);

    expect(mockSetSpeciesValue).toHaveBeenCalledWith(9);
    expect(mockSetFormData.mock.calls[0][0]({ species: 1 })).toEqual({ species: 9 });
    expect(mockSetErrors.mock.calls[0][0]({ species: "required" })).toEqual({ species: undefined });
    expect(mockSetSpeciesData).toHaveBeenCalledWith({ value: 9, label: "Robin" });
  });

  it("clears speciesData when the selected value has no matching dropdown item", async () => {
    await render(<ObservationForm {...baseProps()} />);
    dropdownProps("SpeciesDropdown").setValue(999);
    expect(mockSetSpeciesData).toHaveBeenCalledWith(null);
  });

  it("disables already-added species via renderOption, still active for the rest", async () => {
    await render(<ObservationForm {...baseProps()} existingSpecies={new Set([9])} />);
    const { renderOption } = dropdownProps("SpeciesDropdown");

    await render(
      renderOption({ item: { value: 9 }, selected: null, onSelect: jest.fn(), onClose: jest.fn(), index: 0 }),
    );
    expect(screen.getByText("disabled")).toBeOnTheScreen();
  });
});

describe("location auto-request effect", () => {
  it("requests location once a territory is set and location isn't already available", async () => {
    await render(<ObservationForm {...baseProps()} territoryValue={5} />);
    expect(mockRequestLocation).toHaveBeenCalledTimes(1);
  });

  it("does not request location without a territory", async () => {
    await render(<ObservationForm {...baseProps()} territoryValue={null} />);
    expect(mockRequestLocation).not.toHaveBeenCalled();
  });

  it("does not request location once permission was denied", async () => {
    (useLocation as jest.Mock).mockReturnValue({
      locationCoords: null,
      locationAvailable: false,
      permissionStatus: "denied",
      requestLocation: mockRequestLocation,
    });
    await render(<ObservationForm {...baseProps()} territoryValue={5} />);
    expect(mockRequestLocation).not.toHaveBeenCalled();
  });

  it("does not request location once it's already available", async () => {
    (useLocation as jest.Mock).mockReturnValue({
      locationCoords: [1, 2],
      locationAvailable: true,
      permissionStatus: "granted",
      requestLocation: mockRequestLocation,
    });
    await render(<ObservationForm {...baseProps()} territoryValue={5} />);
    expect(mockRequestLocation).not.toHaveBeenCalled();
  });
});

describe("species-still-valid effect", () => {
  it("clears a selected species that disappeared from the dropdown's results", async () => {
    queriesByType.SpeciesDropdown = { data: [{ value: 1, label: "Other" }] };
    await render(<ObservationForm {...baseProps()} speciesValue={9} />);
    expect(mockSetSpeciesValue).toHaveBeenCalledWith(null);
  });

  it("leaves a still-present species value untouched", async () => {
    queriesByType.SpeciesDropdown = { data: [{ value: 9, label: "Robin" }] };
    await render(<ObservationForm {...baseProps()} speciesValue={9} />);
    expect(mockSetSpeciesValue).not.toHaveBeenCalled();
  });

  // useEditorForm looks up the label for `defaultSpecies` in the dropdown cache
  // once, on mount: a freshly created account has no cache yet, so the field
  // looked empty while holding a value — "pick a species" above an already
  // picked species.
  it("labels a prefilled species once the dropdown's results arrive", async () => {
    queriesByType.SpeciesDropdown = { data: [{ value: 9, label: "Robin" }] };
    await render(<ObservationForm {...baseProps()} speciesValue={9} />);
    expect(mockSetSpeciesData).toHaveBeenCalledWith({
      value: 9,
      label: "Robin",
    });
  });

  it("does not overwrite a label that is already there", async () => {
    queriesByType.SpeciesDropdown = { data: [{ value: 9, label: "Robin" }] };
    await render(
      <ObservationForm
        {...baseProps()}
        speciesValue={9}
        speciesData={{ value: 9, label: "Robin (already resolved)" }}
      />,
    );
    expect(mockSetSpeciesData).not.toHaveBeenCalled();
  });
});

describe("date/privacy/place section visibility", () => {
  it("renders date, privacy toggle and the place block for a plain (non-diary) observation", async () => {
    await render(<ObservationForm {...baseProps()} />);
    expect(mockDateInputCapture).toHaveBeenCalled();
    expect(mockPrivacyToggleCapture).toHaveBeenCalled();
    expect(mockPlaceBlockCapture).toHaveBeenCalled();
  });

  it("hides date/privacy/place for a diary-scoped observation, in both create and edit mode", async () => {
    await render(<ObservationForm {...baseProps()} isDiaryMode />);
    expect(mockDateInputCapture).not.toHaveBeenCalled();
    expect(mockPrivacyToggleCapture).not.toHaveBeenCalled();
    expect(mockPlaceBlockCapture).not.toHaveBeenCalled();

    jest.clearAllMocks();
    (useDropdownQuery as jest.Mock).mockImplementation(({ type }: { type: string }) => ({
      query: queriesByType[type],
      sort: `${type}-sort`,
      onSortChange: onSortChangeByType[type],
    }));
    await render(<ObservationForm {...baseProps()} isDiaryMode isEditMode />);
    expect(mockDateInputCapture).not.toHaveBeenCalled();
  });

  it("shows the diary banner only when editing (not creating) inside a diary, wired to onEditDiary", async () => {
    await render(<ObservationForm {...baseProps()} isDiaryMode />);
    expect(screen.queryByText("diary_fields_hint")).not.toBeOnTheScreen();

    await render(<ObservationForm {...baseProps()} isDiaryMode isEditMode />);
    expect(screen.getByText("diary_fields_hint")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("diary_fields_hint"));
    expect(mockOnEditDiary).toHaveBeenCalledTimes(1);
  });
});

describe("date input", () => {
  it("updates formData.date_time and clears the date error on change", async () => {
    await render(<ObservationForm {...baseProps()} />);
    mockDateInputCapture.mock.calls[0][0].onChange("2026-02-01");

    expect(mockSetFormData.mock.calls[0][0]({ date_time: "x" })).toEqual({ date_time: "2026-02-01" });
    expect(mockSetErrors.mock.calls[0][0]({ date_time: "required" })).toEqual({ date_time: undefined });
  });
});

describe("privacy toggle", () => {
  it("updates formData.private on change", async () => {
    await render(<ObservationForm {...baseProps()} />);
    mockPrivacyToggleCapture.mock.calls[0][0].onChange(true);
    expect(mockSetFormData.mock.calls[0][0]({ private: false })).toEqual({ private: true });
  });
});

describe("details section (time/quantity/notes)", () => {
  it("is collapsed only when time, quantity and notes are all empty", async () => {
    await render(<ObservationForm {...baseProps()} />);
    const detailsSection = mockSectionCapture.mock.calls
      .map((c) => c[0])
      .find((p) => p.title === "section_details");
    expect(detailsSection.collapsed).toBe(true);

    jest.clearAllMocks();
    (useDropdownQuery as jest.Mock).mockImplementation(({ type }: { type: string }) => ({
      query: queriesByType[type],
      sort: `${type}-sort`,
      onSortChange: onSortChangeByType[type],
    }));
    await render(<ObservationForm {...baseProps()} formData={{ ...BASE_FORM_DATA, time: "10:00" } as never} />);
    const expandedSection = mockSectionCapture.mock.calls
      .map((c) => c[0])
      .find((p) => p.title === "section_details");
    expect(expandedSection.collapsed).toBe(false);
  });

  it("parses the quantity input as a number, treating a blank string as null", async () => {
    await render(<ObservationForm {...baseProps()} />);
    const quantityInput = mockInputCapture.mock.calls.map((c) => c[0]).find((p) => p.keyboardType === "numeric");

    quantityInput.onUpdateValue("12");
    expect(mockSetFormData.mock.calls[0][0]({ quantity: null })).toEqual({ quantity: 12 });

    quantityInput.onUpdateValue("  ");
    expect(mockSetFormData.mock.calls[1][0]({ quantity: 5 })).toEqual({ quantity: null });
  });

  it("updates notes as plain text", async () => {
    await render(<ObservationForm {...baseProps()} />);
    const notesInput = mockInputCapture.mock.calls.map((c) => c[0]).find((p) => p.multiline);
    notesInput.onUpdateValue("hello");
    expect(mockSetFormData.mock.calls[0][0]({ notes: null })).toEqual({ notes: "hello" });
  });
});

describe("useDropdownQuery wiring", () => {
  it("disables the places/countries queries in diary mode, and gates species on both territory and a defined date filter", async () => {
    await render(<ObservationForm {...baseProps()} isDiaryMode territoryValue={5} />);
    const calls = (useDropdownQuery as jest.Mock).mock.calls.map((c) => c[0]);
    expect(calls.find((c) => c.type === "CountriesDropdown").enabled).toBe(false);
    expect(calls.find((c) => c.type === "PlacesDropdown").enabled).toBe(false);
  });

  it("leaves the species query disabled while the date filter is still undefined", async () => {
    (useFilters as jest.Mock).mockReturnValue({ date: undefined });
    await render(<ObservationForm {...baseProps()} territoryValue={5} />);
    const calls = (useDropdownQuery as jest.Mock).mock.calls.map((c) => c[0]);
    expect(calls.find((c) => c.type === "SpeciesDropdown").enabled).toBe(false);
  });

  it("enables the species query once both a territory and a resolved date filter are present", async () => {
    (useFilters as jest.Mock).mockReturnValue({ date: { type: "all" } });
    await render(<ObservationForm {...baseProps()} territoryValue={5} />);
    const calls = (useDropdownQuery as jest.Mock).mock.calls.map((c) => c[0]);
    expect(calls.find((c) => c.type === "SpeciesDropdown").enabled).toBe(true);
  });
});
