jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name, testID }: { name: string; testID?: string }) => (
      <Text testID={testID ?? `icon-${name}`}>{name}</Text>
    ),
  };
});

const mockDropdownCapture = jest.fn();
jest.mock("../../ui/DropdownInput", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockDropdownCapture(props);
    return null;
  },
}));
jest.mock("../../../store/location-context", () => ({ useLocation: jest.fn() }));
const mockNearbyCapture = jest.fn();
jest.mock("../NearbyPlaceSuggestion", () => {
  const { TouchableOpacity, Text } = require("react-native");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      mockNearbyCapture(props);
      const { onSelect, nearest } = props as {
        onSelect: (p: unknown) => void;
        nearest: { place: unknown };
      };
      return (
        <TouchableOpacity testID="nearby-suggestion" onPress={() => onSelect(nearest.place)}>
          <Text>nearby</Text>
        </TouchableOpacity>
      );
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

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useLocation } from "../../../store/location-context";
import PlaceBlock from "../PlaceBlock";
import { PlaceDropdownItem } from "../../../types";

const mockSetPlaceValue = jest.fn();
const mockSetFormData = jest.fn();
const mockOnAddNewPlace = jest.fn();
const mockSetPlaceData = jest.fn();
const mockOnSortChange = jest.fn();
const mockSetPrivateLocation = jest.fn();

const PLACES: PlaceDropdownItem[] = [
  { value: 9, label: "My Garden", name: "My Garden" },
];

const HERE: [number, number] = [2.35, 48.86];
// ~30 m north of HERE: a degree of latitude is ~111 km.
const NEARBY_PLACE: PlaceDropdownItem = {
  value: 12,
  label: "Old Pond",
  location: { type: "Point", coordinates: [2.35, 48.8602] },
};

const mockLocationCoords = (coords: [number, number] | null) => {
  (useLocation as jest.Mock).mockReturnValue({
    locationCoords: coords,
    locationAvailable: !!coords,
    permissionStatus: "granted",
    requestLocation: jest.fn(),
  });
};

const dropdownProps = () => mockDropdownCapture.mock.calls.at(-1)![0] as {
  value: number | null;
  setValue: (v: number | string | null) => void;
  disabled: boolean;
  disabledMessage?: string;
};

const baseProps = (overrides: Record<string, unknown> = {}) => ({
  territoryValue: 5,
  placeValue: null,
  setPlaceValue: mockSetPlaceValue,
  setFormData: mockSetFormData,
  onAddNewPlace: mockOnAddNewPlace,
  queryPlaces: { data: PLACES } as never,
  sort: "name",
  onSortChange: mockOnSortChange,
  placeData: null,
  setPlaceData: mockSetPlaceData,
  showLocationPrivacy: false,
  privateLocation: false,
  setPrivateLocation: mockSetPrivateLocation,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockLocationCoords(null);
});

it("passes territory-gated disabled state and dropdown wiring through", async () => {
  await render(<PlaceBlock {...baseProps({ territoryValue: null })} />);
  expect(dropdownProps().disabled).toBe(true);
  expect(dropdownProps().disabledMessage).toBe("select_country_first");

  await render(<PlaceBlock {...baseProps({ territoryValue: 5 })} />);
  expect(dropdownProps().disabled).toBe(false);
});

describe("DropdownInput.setValue", () => {
  it("updates placeValue/formData/placeData when a known place is selected", async () => {
    await render(<PlaceBlock {...baseProps()} />);
    dropdownProps().setValue(9);

    expect(mockSetPlaceValue).toHaveBeenCalledWith(9);
    expect(mockSetFormData.mock.calls[0][0]({ place: null })).toEqual({ place: 9 });
    expect(mockSetPlaceData).toHaveBeenCalledWith(PLACES[0]);
  });

  it("sets placeData to null when the selected value isn't in queryPlaces.data", async () => {
    await render(<PlaceBlock {...baseProps()} />);
    dropdownProps().setValue(999);
    expect(mockSetPlaceData).toHaveBeenCalledWith(null);
  });

  it("treats a string value (e.g. a reset sentinel) as clearing formData.place", async () => {
    await render(<PlaceBlock {...baseProps()} />);
    dropdownProps().setValue("reset" as never);
    expect(mockSetFormData.mock.calls[0][0]({ place: 9 })).toEqual({ place: null });
  });
});

describe("location privacy toggle", () => {
  it("is hidden when showLocationPrivacy is false", async () => {
    await render(<PlaceBlock {...baseProps({ showLocationPrivacy: false })} />);
    expect(mockPrivacyToggleCapture).not.toHaveBeenCalled();
  });

  it("is shown and wired when showLocationPrivacy is true", async () => {
    await render(<PlaceBlock {...baseProps({ showLocationPrivacy: true, privateLocation: true })} />);
    expect(mockPrivacyToggleCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        descriptionType: "location",
        value: true,
        onChange: mockSetPrivateLocation,
      }),
    );
  });
});

describe("add new place", () => {
  it("invokes onAddNewPlace with a callback that sets the new place value", async () => {
    await render(<PlaceBlock {...baseProps()} />);
    await fireEvent.press(screen.getByText("add_new_location"));

    expect(mockOnAddNewPlace).toHaveBeenCalledWith(expect.any(Function));
    const callback = (mockOnAddNewPlace.mock.calls[0][0] as (v: number) => void);
    callback(42);
    expect(mockSetPlaceValue).toHaveBeenCalledWith(42);
  });
});

describe("nearby place suggestion", () => {
  const renderNearby = async (overrides: Record<string, unknown> = {}) => {
    mockLocationCoords(HERE);
    return render(
      <PlaceBlock {...baseProps({ queryPlaces: { data: [NEARBY_PLACE] } as never, ...overrides })} />,
    );
  };

  it("offers the place the user is standing at", async () => {
    await renderNearby();

    expect(screen.queryByTestId("nearby-suggestion")).not.toBeNull();
    const props = mockNearbyCapture.mock.calls.at(-1)![0];
    expect(props.variant).toBe("picker");
    expect(props.nearest.place).toEqual(NEARBY_PLACE);
  });

  it("stays out of the way once a place has been chosen", async () => {
    await renderNearby({ placeValue: 9 });
    expect(screen.queryByTestId("nearby-suggestion")).toBeNull();
  });

  it("says nothing without a location fix", async () => {
    await render(
      <PlaceBlock {...baseProps({ queryPlaces: { data: [NEARBY_PLACE] } as never })} />,
    );
    expect(screen.queryByTestId("nearby-suggestion")).toBeNull();
  });

  it("fills the whole picker in when accepted", async () => {
    await renderNearby();
    await fireEvent.press(screen.getByTestId("nearby-suggestion"));

    expect(mockSetPlaceValue).toHaveBeenCalledWith(12);
    expect(mockSetFormData.mock.calls[0][0]({ place: null })).toEqual({ place: 12 });
    expect(mockSetPlaceData).toHaveBeenCalledWith(NEARBY_PLACE);
  });

  it("is dismissable, and stays dismissed", async () => {
    await renderNearby();
    const { onDismiss } = mockNearbyCapture.mock.calls.at(-1)![0];
    await act(async () => {
      onDismiss();
    });

    expect(screen.queryByTestId("nearby-suggestion")).toBeNull();
  });
});
