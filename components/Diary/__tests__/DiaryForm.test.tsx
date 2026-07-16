jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../util/fetches", () => ({
  fetchMyCountries: jest.fn(),
  fetchMyPlaces: jest.fn(),
}));
jest.mock("../../../store/language-context", () => ({ useLanguage: jest.fn() }));
jest.mock("../../../store/location-context", () => ({ useLocation: jest.fn() }));
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
const mockInputCapture = jest.fn();
jest.mock("../../ui/Input", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockInputCapture(props);
    return null;
  },
}));
jest.mock("../../ui/Section", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({ children }: { children: import("react").ReactNode }) => <View>{children}</View>,
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

import { render } from "@testing-library/react-native";
import { useLanguage } from "../../../store/language-context";
import { useLocation } from "../../../store/location-context";
import { useDropdownQuery } from "../../../hooks/useDropdownQuery";
import DiaryForm from "../DiaryForm";

const mockHandleLocationUnavailable = jest.fn();
const mockSetFormData = jest.fn();
const mockSetErrors = jest.fn();
const mockSetTerritoryValue = jest.fn();
const mockSetPlaceValue = jest.fn();
const mockSetPlaceData = jest.fn();
const mockOnAddNewPlace = jest.fn();
const mockRequestLocation = jest.fn();

const queriesByType: Record<string, { data: unknown[] }> = {};
const onSortChangeByType: Record<string, jest.Mock> = {};

const BASE_FORM_DATA = {
  date_time: "2026-01-01",
  name: null as string | null,
  private: false,
  location_private: true,
};

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
});

const dropdownProps = () => mockDropdownCapture.mock.calls.at(-1)![0];

beforeEach(() => {
  jest.clearAllMocks();
  (useLanguage as jest.Mock).mockReturnValue({ language: "en" });
  (useLocation as jest.Mock).mockReturnValue({
    locationCoords: null,
    locationAvailable: false,
    permissionStatus: "undetermined",
    requestLocation: mockRequestLocation,
  });

  queriesByType.CountriesDropdown = { data: [{ value: 5, label: "France" }] };
  queriesByType.PlacesDropdown = { data: [] };
  onSortChangeByType.CountriesDropdown = jest.fn();
  onSortChangeByType.PlacesDropdown = jest.fn();

  (useDropdownQuery as jest.Mock).mockImplementation(({ type }: { type: string }) => ({
    query: queriesByType[type],
    sort: `${type}-sort`,
    onSortChange: onSortChangeByType[type],
  }));
});

describe("territory dropdown", () => {
  it("updates territoryValue/formData, clears the territory error, and resets the place on selection", async () => {
    await render(<DiaryForm {...baseProps()} />);
    dropdownProps().setValue(7);

    expect(mockSetTerritoryValue).toHaveBeenCalledWith(7);
    expect(mockSetFormData.mock.calls[0][0]({ territory: 1 })).toEqual({ territory: 7 });
    expect(mockSetErrors.mock.calls[0][0]({ territory: "required" })).toEqual({ territory: undefined });
    expect(mockSetPlaceValue).toHaveBeenCalledWith(null);
  });

  it("is disabled while editing an existing diary (territory can't change after creation)", async () => {
    await render(<DiaryForm {...baseProps()} isEditMode />);
    expect(dropdownProps().disabled).toBe(true);

    await render(<DiaryForm {...baseProps()} isEditMode={false} />);
    expect(dropdownProps().disabled).toBeFalsy();
  });
});

describe("location auto-request effect", () => {
  it("requests location once a territory is set and location isn't already available", async () => {
    await render(<DiaryForm {...baseProps()} territoryValue={5} />);
    expect(mockRequestLocation).toHaveBeenCalledTimes(1);
  });

  it("does not request location without a territory", async () => {
    await render(<DiaryForm {...baseProps()} territoryValue={null} />);
    expect(mockRequestLocation).not.toHaveBeenCalled();
  });

  it("does not request location once permission was denied", async () => {
    (useLocation as jest.Mock).mockReturnValue({
      locationCoords: null,
      locationAvailable: false,
      permissionStatus: "denied",
      requestLocation: mockRequestLocation,
    });
    await render(<DiaryForm {...baseProps()} territoryValue={5} />);
    expect(mockRequestLocation).not.toHaveBeenCalled();
  });

  it("does not request location once it's already available", async () => {
    (useLocation as jest.Mock).mockReturnValue({
      locationCoords: [1, 2],
      locationAvailable: true,
      permissionStatus: "granted",
      requestLocation: mockRequestLocation,
    });
    await render(<DiaryForm {...baseProps()} territoryValue={5} />);
    expect(mockRequestLocation).not.toHaveBeenCalled();
  });
});

describe("date input", () => {
  it("updates formData.date_time and clears the date error on change", async () => {
    await render(<DiaryForm {...baseProps()} />);
    mockDateInputCapture.mock.calls[0][0].onChange("2026-02-01");

    expect(mockSetFormData.mock.calls[0][0]({ date_time: "x" })).toEqual({ date_time: "2026-02-01" });
    expect(mockSetErrors.mock.calls[0][0]({ date_time: "required" })).toEqual({ date_time: undefined });
  });
});

describe("name input", () => {
  it("updates formData.name as plain text", async () => {
    await render(<DiaryForm {...baseProps()} />);
    mockInputCapture.mock.calls[0][0].onUpdateValue("Morning walk");
    expect(mockSetFormData.mock.calls[0][0]({ name: null })).toEqual({ name: "Morning walk" });
  });
});

describe("privacy toggle", () => {
  it("updates formData.private on change, using the male description variant", async () => {
    await render(<DiaryForm {...baseProps()} />);
    expect(mockPrivacyToggleCapture.mock.calls[0][0].descriptionType).toBe("male");
    mockPrivacyToggleCapture.mock.calls[0][0].onChange(true);
    expect(mockSetFormData.mock.calls[0][0]({ private: false })).toEqual({ private: true });
  });
});

describe("place block", () => {
  it("is wired to the same territory/place state and location-privacy toggle", async () => {
    await render(<DiaryForm {...baseProps()} placeValue={2} />);
    const props = mockPlaceBlockCapture.mock.calls[0][0] as {
      territoryValue: number;
      placeValue: number;
      showLocationPrivacy: boolean;
      setPrivateLocation: (v: boolean) => void;
    };
    expect(props.territoryValue).toBe(5);
    expect(props.placeValue).toBe(2);
    expect(props.showLocationPrivacy).toBe(true);

    props.setPrivateLocation(false);
    expect(mockSetFormData.mock.calls[0][0]({ location_private: true })).toEqual({ location_private: false });
  });

  it("hides the location-privacy toggle for a private diary or without a place", async () => {
    await render(<DiaryForm {...baseProps()} placeValue={null} />);
    expect(mockPlaceBlockCapture.mock.calls[0][0].showLocationPrivacy).toBe(false);

    await render(<DiaryForm {...baseProps()} placeValue={2} formData={{ ...BASE_FORM_DATA, private: true } as never} />);
    expect(mockPlaceBlockCapture.mock.calls.at(-1)![0].showLocationPrivacy).toBe(false);
  });
});

describe("useDropdownQuery wiring", () => {
  it("only enables the places query once a territory is selected", async () => {
    await render(<DiaryForm {...baseProps()} territoryValue={null} />);
    let calls = (useDropdownQuery as jest.Mock).mock.calls.map((c) => c[0]);
    expect(calls.find((c) => c.type === "PlacesDropdown").enabled).toBe(false);

    jest.clearAllMocks();
    (useDropdownQuery as jest.Mock).mockImplementation(({ type }: { type: string }) => ({
      query: queriesByType[type],
      sort: `${type}-sort`,
      onSortChange: onSortChangeByType[type],
    }));
    await render(<DiaryForm {...baseProps()} territoryValue={5} />);
    calls = (useDropdownQuery as jest.Mock).mock.calls.map((c) => c[0]);
    expect(calls.find((c) => c.type === "PlacesDropdown").enabled).toBe(true);
  });
});
