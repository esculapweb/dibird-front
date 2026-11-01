jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("../../../util/fetches", () => ({ fetchMyCountries: jest.fn() }));
jest.mock("../../../store/language-context", () => ({ useLanguage: () => ({ language: "en" }) }));
jest.mock("../../../hooks/useDropdownQuery", () => ({ useDropdownQuery: jest.fn() }));

const mockInputCapture = jest.fn();
jest.mock("../../ui/Input", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockInputCapture(props);
    return null;
  },
}));
const mockDropdownCapture = jest.fn();
jest.mock("../../ui/DropdownInput", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockDropdownCapture(props);
    return null;
  },
}));

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useDropdownQuery } from "../../../hooks/useDropdownQuery";
import PlaceForm from "../PlaceForm";

const mockOnCoordsChange = jest.fn();
const mockSetFormData = jest.fn();
const mockSetLatText = jest.fn();
const mockSetLngText = jest.fn();
const mockSetErrors = jest.fn();
const mockOnSortChange = jest.fn();

let countriesData: Array<{ value: number; code: string; label: string }> = [];

const baseProps = () => ({
  onCoordsChange: mockOnCoordsChange,
  formData: { name: "", territory: null } as never,
  setFormData: mockSetFormData,
  coords: null,
  latText: "",
  lngText: "",
  setLatText: mockSetLatText,
  setLngText: mockSetLngText,
  errors: {},
  setErrors: mockSetErrors,
  locationDetails: null,
});

const inputProps = (testID: string) =>
  mockInputCapture.mock.calls.map((c) => c[0]).find((p) => p.testID === testID);
const dropdownProps = () => mockDropdownCapture.mock.calls.at(-1)![0];

beforeEach(() => {
  jest.clearAllMocks();
  countriesData = [
    { value: 5, code: "FR", label: "France" },
    { value: 7, code: "DE", label: "Germany" },
  ];
  (useDropdownQuery as jest.Mock).mockImplementation(() => ({
    query: { data: countriesData },
    sort: "name",
    onSortChange: mockOnSortChange,
  }));
});

describe("name input", () => {
  it("updates formData.name and clears the name error", async () => {
    await render(<PlaceForm {...baseProps()} />);
    inputProps("place-name-input").onUpdateValue("City Park");

    expect(mockSetFormData.mock.calls[0][0]({ name: "" })).toEqual({ name: "City Park" });
    expect(mockSetErrors.mock.calls[0][0]({ name: "required" })).toEqual({ name: undefined });
  });
});

describe("coordinates row", () => {
  const expand = () => fireEvent.press(screen.getByTestId("place-coords-toggle"));

  it("is collapsed by default: a summary of both coords, no lat/lng inputs", async () => {
    await render(<PlaceForm {...baseProps()} latText="48.8566" lngText="2.3522" />);

    expect(screen.getByTestId("place-coords-summary")).toHaveTextContent("48.8566, 2.3522");
    expect(inputProps("latitude-input")).toBeUndefined();
    expect(inputProps("longitude-input")).toBeUndefined();
  });

  it("shows the placeholder while there are no coords yet", async () => {
    await render(<PlaceForm {...baseProps()} />);
    expect(screen.getByTestId("place-coords-summary")).toHaveTextContent("coordinates");
  });

  it("opens the lat/lng inputs on tap and folds them back on a second tap", async () => {
    await render(<PlaceForm {...baseProps()} />);
    await act(async () => expand());
    expect(inputProps("latitude-input")).toBeDefined();

    mockInputCapture.mockClear();
    await act(async () => expand());
    expect(inputProps("latitude-input")).toBeUndefined();
  });

  it("reports the opening (to unfold the sheet), but not the folding", async () => {
    const onCoordsExpand = jest.fn();
    await render(<PlaceForm {...baseProps()} onCoordsExpand={onCoordsExpand} />);
    await act(async () => expand());
    await act(async () => expand());
    expect(onCoordsExpand).toHaveBeenCalledTimes(1);
  });

  it("opens by itself on a coordinate error and stays open once the error clears", async () => {
    const onCoordsExpand = jest.fn();
    const { rerender } = await render(
      <PlaceForm
        {...baseProps()}
        errors={{ latitude: "invalid_latitude" }}
        onCoordsExpand={onCoordsExpand}
      />,
    );
    expect(inputProps("latitude-input")).toBeDefined();
    expect(onCoordsExpand).toHaveBeenCalledTimes(1);

    mockInputCapture.mockClear();
    await rerender(<PlaceForm {...baseProps()} errors={{}} />);
    expect(inputProps("latitude-input")).toBeDefined();
  });

  it("replaces a comma with a dot and reports both coords as manual on latitude change", async () => {
    await render(<PlaceForm {...baseProps()} lngText="2.5" />);
    await act(async () => expand());
    inputProps("latitude-input").onUpdateValue("48,5");

    expect(mockSetLatText).toHaveBeenCalledWith("48.5");
    expect(mockOnCoordsChange).toHaveBeenCalledWith(["2.5", "48.5"], { fromManual: true });
  });

  it("replaces a comma with a dot and reports both coords as manual on longitude change", async () => {
    await render(<PlaceForm {...baseProps()} latText="48.5" />);
    await act(async () => expand());
    inputProps("longitude-input").onUpdateValue("2,5");

    expect(mockSetLngText).toHaveBeenCalledWith("2.5");
    expect(mockOnCoordsChange).toHaveBeenCalledWith(["2.5", "48.5"], { fromManual: true });
  });
});

describe("territory dropdown", () => {
  it("manually selecting a territory sets it as a number and clears the error", async () => {
    await render(<PlaceForm {...baseProps()} />);
    await act(async () => {
      dropdownProps().setValue(7);
    });

    expect(mockSetFormData.mock.calls[0][0]({ territory: 1 })).toEqual({ territory: 7 });
    expect(mockSetErrors.mock.calls[0][0]({ territory: "required" })).toEqual({ territory: undefined });
  });

  it("seeds the dropdown from formData.territory when editing an existing place", async () => {
    await render(<PlaceForm {...baseProps()} formData={{ name: "", territory: 5 } as never} isEditMode />);
    expect(dropdownProps().value).toBe(5);
  });

  it("does not seed from formData.territory outside edit mode", async () => {
    await render(<PlaceForm {...baseProps()} formData={{ name: "", territory: 5 } as never} isEditMode={false} />);
    expect(dropdownProps().value).toBeNull();
  });

  describe("auto-detection from reverse geocoding (create mode only)", () => {
    it("selects the matching territory by country code, case-insensitively", async () => {
      await render(
        <PlaceForm {...baseProps()} locationDetails={{ country_code: "fr" } as never} />,
      );
      expect(dropdownProps().value).toBe(5);
      expect(mockSetFormData.mock.calls[0][0]({ territory: 1 })).toEqual({ territory: 5 });
      expect(mockSetErrors.mock.calls[0][0]({ territory: "required" })).toEqual({ territory: undefined });
    });

    it("does nothing when no territory matches the geocoded country code", async () => {
      await render(<PlaceForm {...baseProps()} locationDetails={{ country_code: "us" } as never} />);
      expect(mockSetFormData).not.toHaveBeenCalled();
    });

    it("does nothing without a country code, or before the countries list has loaded", async () => {
      await render(<PlaceForm {...baseProps()} locationDetails={{} as never} />);
      expect(mockSetFormData).not.toHaveBeenCalled();

      countriesData = [];
      await render(<PlaceForm {...baseProps()} locationDetails={{ country_code: "fr" } as never} />);
      expect(mockSetFormData).not.toHaveBeenCalled();
    });

    it("is skipped entirely in edit mode, even with a matching country code", async () => {
      await render(
        <PlaceForm {...baseProps()} isEditMode locationDetails={{ country_code: "fr" } as never} />,
      );
      expect(mockSetFormData).not.toHaveBeenCalled();
    });
  });
});
