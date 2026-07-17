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
const mockPrivacyToggleCapture = jest.fn();
jest.mock("../../ui/PrivacyToggle", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockPrivacyToggleCapture(props);
    return null;
  },
}));

import { fireEvent, render, screen } from "@testing-library/react-native";
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
