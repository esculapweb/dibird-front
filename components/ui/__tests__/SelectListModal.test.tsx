jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));

const mockModalWrapperCapture = jest.fn();
jest.mock("../ModalWrapper", () => {
  const { View, Text, TouchableOpacity } = require("react-native");
  return {
    __esModule: true,
    default: ({
      children,
      visible,
      onClose,
      title,
      onSort,
      showSortIcon,
    }: {
      children: import("react").ReactNode;
      visible: boolean;
      onClose: () => void;
      title?: string;
      onSort?: () => void;
      showSortIcon?: boolean;
    }) => {
      mockModalWrapperCapture({ visible, title, showSortIcon });
      if (!visible) return null;
      return (
        <View>
          {title && <Text>{title}</Text>}
          <TouchableOpacity testID="modal-close" onPress={onClose}>
            <Text>close</Text>
          </TouchableOpacity>
          {showSortIcon && (
            <TouchableOpacity testID="modal-sort-toggle" onPress={onSort}>
              <Text>sort</Text>
            </TouchableOpacity>
          )}
          {children}
        </View>
      );
    },
  };
});

jest.mock("../SearchInput", () => {
  const { View, TextInput, TouchableOpacity, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({
      value,
      onChange,
      onClear,
    }: {
      value?: string;
      onChange?: (v: string) => void;
      onClear?: () => void;
    }) => (
      <View>
        <TextInput testID="search-input" value={value} onChangeText={onChange} />
        <TouchableOpacity testID="search-clear" onPress={onClear}>
          <Text>clear</Text>
        </TouchableOpacity>
      </View>
    ),
  };
});

const mockRadioGroupCapture = jest.fn();
jest.mock("../RadioGroup", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockRadioGroupCapture(props);
    return null;
  },
}));

const mockDefaultOptionRowCapture = jest.fn();
jest.mock("../DefaultOptionRow", () => {
  const { TouchableOpacity, Text } = require("react-native");
  return {
    __esModule: true,
    default: (props: {
      item: { value: string | number; label: string };
      onSelect: (v: string | number | null) => void;
      onClose: () => void;
      index?: number;
    }) => {
      mockDefaultOptionRowCapture(props);
      return (
        <TouchableOpacity
          testID={`option-${props.item.value}`}
          onPress={() => {
            props.onSelect(props.item.value);
            props.onClose();
          }}
        >
          <Text>{props.item.label}</Text>
        </TouchableOpacity>
      );
    },
  };
});

// The real map pulls in MapL's native modules; the picker only needs to know
// what it was handed and to fire its two callbacks.
const mockPlacesMapCapture = jest.fn();
jest.mock("../../Map/PlacesMap", () => {
  const { TouchableOpacity, Text, View } = require("react-native");
  return {
    __esModule: true,
    default: (props: {
      featureCollection: { features: { properties: { id: number } }[] };
      onSelectPlace: (p: { id: number }) => void;
      onPressEmpty?: (c: [number, number]) => void;
    }) => {
      mockPlacesMapCapture(props);
      return (
        <View testID="places-map">
          {props.featureCollection.features.map((f) => (
            <TouchableOpacity
              key={f.properties.id}
              testID={`map-place-${f.properties.id}`}
              onPress={() => props.onSelectPlace(f.properties)}
            >
              <Text>pin</Text>
            </TouchableOpacity>
          ))}
          {props.onPressEmpty && (
            <TouchableOpacity
              testID="map-empty"
              onPress={() => props.onPressEmpty!([2.35, 48.86])}
            >
              <Text>empty</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    },
  };
});

let mockOnline = true;
jest.mock("../../../hooks/useIsOnline", () => ({
  useIsOnline: () => mockOnline,
}));

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import SelectListModal from "../SelectListModal";
import { DropdownItem } from "../../../types";

const OPTIONS: DropdownItem[] = [
  { value: 1, label: "France" },
  { value: 2, label: "Germany" },
  { value: 3, label: "Ёлочная" },
];

const mockOnSelect = jest.fn();
const mockOnClose = jest.fn();
const mockSetSearch = jest.fn();
const mockOnSortChange = jest.fn();
const mockOnLocationUnavailable = jest.fn();

const baseProps = (overrides: Record<string, unknown> = {}) => ({
  visible: true,
  options: OPTIONS,
  selected: null,
  onSelect: mockOnSelect,
  onClose: mockOnClose,
  search: "",
  setSearch: mockSetSearch,
  ...overrides,
});

const radioProps = () => mockRadioGroupCapture.mock.calls.at(-1)![0];

beforeEach(() => {
  jest.clearAllMocks();
  mockOnline = true;
});

it("shows nothing when not visible", async () => {
  await render(<SelectListModal {...baseProps({ visible: false })} />);
  expect(screen.queryByText("France")).not.toBeOnTheScreen();
});

it("shows the empty-options message and no search input when there are no options", async () => {
  await render(<SelectListModal {...baseProps({ options: [] })} />);
  expect(screen.getByText("no_options_available")).toBeOnTheScreen();
  expect(screen.queryByTestId("search-input")).not.toBeOnTheScreen();
});

it("renders every option via DefaultOptionRow by default", async () => {
  await render(<SelectListModal {...baseProps()} />);
  expect(screen.getByText("France")).toBeOnTheScreen();
  expect(screen.getByText("Germany")).toBeOnTheScreen();
  expect(screen.getByText("Ёлочная")).toBeOnTheScreen();
});

it("selects an option and closes on tap", async () => {
  await render(<SelectListModal {...baseProps()} />);
  await fireEvent.press(screen.getByText("France"));
  expect(mockOnSelect).toHaveBeenCalledWith(1);
  expect(mockOnClose).toHaveBeenCalledTimes(1);
});

describe("custom renderOption", () => {
  it("uses renderOption instead of DefaultOptionRow when provided", async () => {
    const renderOption = jest.fn(() => null);
    await render(<SelectListModal {...baseProps()} renderOption={renderOption} />);
    expect(mockDefaultOptionRowCapture).not.toHaveBeenCalled();
    expect(renderOption).toHaveBeenCalledWith(
      expect.objectContaining({ item: OPTIONS[0], selected: null }),
    );
  });
});

describe("search filtering", () => {
  it("filters options by label, case-insensitively", async () => {
    await render(<SelectListModal {...baseProps({ search: "ger" })} />);
    expect(screen.getByText("Germany")).toBeOnTheScreen();
    expect(screen.queryByText("France")).not.toBeOnTheScreen();
  });

  it("normalizes ё to е for both the search term and the option label", async () => {
    await render(<SelectListModal {...baseProps({ search: "ёлочная" })} />);
    expect(screen.getByText("Ёлочная")).toBeOnTheScreen();

    await render(<SelectListModal {...baseProps({ search: "елочная" })} />);
    expect(screen.getByText("Ёлочная")).toBeOnTheScreen();
  });

  it("shows 'nothing_found' when the search matches no option", async () => {
    await render(<SelectListModal {...baseProps({ search: "xyz" })} />);
    expect(screen.getByText("nothing_found")).toBeOnTheScreen();
  });

  it("wires the search input to search/setSearch/clear", async () => {
    await render(<SelectListModal {...baseProps({ search: "fr" })} />);
    expect(screen.getByTestId("search-input").props.value).toBe("fr");

    await fireEvent.changeText(screen.getByTestId("search-input"), "de");
    expect(mockSetSearch).toHaveBeenCalledWith("de");

    await fireEvent.press(screen.getByTestId("search-clear"));
    expect(mockSetSearch).toHaveBeenCalledWith("");
  });
});

describe("sort menu", () => {
  it("hides the sort icon/menu without a type", async () => {
    await render(<SelectListModal {...baseProps()} />);
    expect(mockModalWrapperCapture).toHaveBeenLastCalledWith(
      expect.objectContaining({ showSortIcon: false }),
    );
    expect(screen.queryByTestId("modal-sort-toggle")).not.toBeOnTheScreen();
  });

  it("shows the sort icon with a type, and toggles the RadioGroup menu on press", async () => {
    await render(<SelectListModal {...baseProps({ type: "Places", sort: "name" })} />);
    expect(mockModalWrapperCapture).toHaveBeenLastCalledWith(
      expect.objectContaining({ showSortIcon: true }),
    );
    expect(mockRadioGroupCapture).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId("modal-sort-toggle"));
    expect(mockRadioGroupCapture).toHaveBeenCalledWith(
      expect.objectContaining({ value: "name" }),
    );
  });

  it("applies a sort change, closing the menu and calling onSortChange", async () => {
    await render(<SelectListModal {...baseProps({ type: "Places", sort: "name", onSortChange: mockOnSortChange })} />);
    await fireEvent.press(screen.getByTestId("modal-sort-toggle"));

    await act(async () => radioProps().onChange("-name"));
    expect(mockOnSortChange).toHaveBeenCalledWith("-name");
  });

  it("resyncs sortOrder when the sort prop changes externally", async () => {
    const { rerender } = await render(
      <SelectListModal {...baseProps({ type: "Places", sort: "name" })} />,
    );
    await fireEvent.press(screen.getByTestId("modal-sort-toggle"));
    expect(radioProps().value).toBe("name");

    await rerender(<SelectListModal {...baseProps({ type: "Places", sort: "-name" })} />);
    expect(radioProps().value).toBe("-name");
  });

  it("disables distance sort options and routes their tap to onLocationUnavailable+onClose when location isn't available", async () => {
    await render(
      <SelectListModal
        {...baseProps({
          type: "Places",
          sort: "name",
          locationAvailable: false,
          onLocationUnavailable: mockOnLocationUnavailable,
        })}
      />,
    );
    await fireEvent.press(screen.getByTestId("modal-sort-toggle"));

    expect(radioProps().disabledValues).toEqual(
      expect.arrayContaining(["distance", "-distance"]),
    );

    await act(async () => radioProps().onDisabledPress());
    expect(mockOnLocationUnavailable).toHaveBeenCalledTimes(1);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("leaves distance sort enabled when location is available", async () => {
    await render(
      <SelectListModal {...baseProps({ type: "Places", sort: "name", locationAvailable: true })} />,
    );
    await fireEvent.press(screen.getByTestId("modal-sort-toggle"));
    expect(radioProps().disabledValues).toEqual([]);
  });
});

describe("multi-select mode", () => {
  const mockOnConfirmMultiple = jest.fn();
  // A row that shows its checked state the way SpeciesOptionRow does.
  const renderOption = ({
    item,
    onSelect,
    multiple,
    checked,
    onToggle,
  }: {
    item: DropdownItem;
    onSelect: (v: string | number | null) => void;
    multiple?: boolean;
    checked?: boolean;
    onToggle?: (v: string | number) => void;
  }) => {
    const { TouchableOpacity, Text } = require("react-native");
    return (
      <TouchableOpacity
        testID={`row-${item.value}`}
        onPress={() => (multiple ? onToggle!(item.value) : onSelect(item.value))}
      >
        <Text>{`${item.label}${checked ? " [x]" : ""}`}</Text>
      </TouchableOpacity>
    );
  };

  const multiProps = (overrides: Record<string, unknown> = {}) =>
    baseProps({
      allowMultiple: true,
      onConfirmMultiple: mockOnConfirmMultiple,
      renderOption,
      ...overrides,
    });

  it("picks a single row and shows no Done button unless allowed", async () => {
    await render(<SelectListModal {...baseProps({ renderOption })} />);
    expect(screen.queryByTestId("select-multiple-done")).toBeNull();
    await act(async () => fireEvent.press(screen.getByTestId("row-2")));
    expect(mockOnSelect).toHaveBeenCalledWith(2);
  });

  it("checks rows instead of picking them and confirms the set in tap order", async () => {
    await render(<SelectListModal {...multiProps()} />);

    await act(async () => fireEvent.press(screen.getByTestId("row-2")));
    await act(async () => fireEvent.press(screen.getByTestId("row-1")));

    expect(mockOnSelect).not.toHaveBeenCalled();
    expect(mockOnClose).not.toHaveBeenCalled();
    expect(screen.getByText("France [x]")).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByTestId("select-multiple-done")));
    expect(mockOnConfirmMultiple).toHaveBeenCalledWith([2, 1]);
  });

  it("unchecks a row on a second tap", async () => {
    await render(<SelectListModal {...multiProps()} />);

    await act(async () => fireEvent.press(screen.getByTestId("row-1")));
    await act(async () => fireEvent.press(screen.getByTestId("row-2")));
    await act(async () => fireEvent.press(screen.getByTestId("row-1")));
    await act(async () => fireEvent.press(screen.getByTestId("select-multiple-done")));

    expect(mockOnConfirmMultiple).toHaveBeenCalledWith([2]);
  });

  it("reopens in multi-select with the form's current set already checked", async () => {
    await render(<SelectListModal {...multiProps({ selected: 1, selectedValues: [1, 3] })} />);

    expect(screen.getByText("France [x]")).toBeTruthy();
    expect(screen.getByText("Ёлочная [x]")).toBeTruthy();
    expect(screen.getByText("Germany")).toBeTruthy();
  });
});

describe("place map view", () => {
  const PLACES = [
    {
      value: 7,
      label: "Pond",
      location: { type: "Point", coordinates: [2.3, 48.8] },
    },
    {
      value: 8,
      label: "Garden",
      location: { type: "Point", coordinates: [2.4, 48.9] },
    },
    // No coordinates: listed, but nothing to plot.
    { value: 9, label: "Nowhere" },
  ];
  const mockOnPickPoint = jest.fn();
  const mapProps = (overrides: Record<string, unknown> = {}) =>
    baseProps({ options: PLACES, mapEnabled: true, type: "PlacesDropdown", ...overrides });
  const renderOnMap = async (overrides: Record<string, unknown> = {}) => {
    await render(<SelectListModal {...mapProps(overrides)} />);
    await act(async () => fireEvent.press(screen.getByTestId("place-picker-view-map")));
  };

  it("offers no switch unless the map is enabled", async () => {
    await render(<SelectListModal {...baseProps()} />);
    expect(screen.queryByTestId("place-picker-view-map")).not.toBeOnTheScreen();
  });

  it("opens on the list and switches to the map with the plottable places", async () => {
    await render(<SelectListModal {...mapProps()} />);
    expect(screen.getByText("Pond")).toBeOnTheScreen();
    expect(screen.queryByTestId("places-map")).not.toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByTestId("place-picker-view-map")));

    expect(screen.getByTestId("places-map")).toBeOnTheScreen();
    expect(screen.getByTestId("map-place-7")).toBeOnTheScreen();
    expect(screen.queryByTestId("map-place-9")).not.toBeOnTheScreen();
    // Sorting has no meaning for points on a map.
    expect(mockModalWrapperCapture.mock.calls.at(-1)![0].showSortIcon).toBe(false);
  });

  it("rings the current place and picks another from the map", async () => {
    await renderOnMap({ selected: 8 });

    expect(mockPlacesMapCapture.mock.calls.at(-1)![0].selectedId).toBe(8);
    await act(async () => fireEvent.press(screen.getByTestId("map-place-7")));
    expect(mockOnSelect).toHaveBeenCalledWith(7);
  });

  it("narrows the map with the search, like the list", async () => {
    await renderOnMap({ search: "gar" });
    expect(screen.getByTestId("map-place-8")).toBeOnTheScreen();
    expect(screen.queryByTestId("map-place-7")).not.toBeOnTheScreen();
  });

  it("hands an empty-ground tap to onPickPoint after closing", async () => {
    await renderOnMap({ onPickPoint: mockOnPickPoint });
    expect(screen.getByText("place_picker_map_hint")).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByTestId("map-empty")));
    expect(mockOnClose).toHaveBeenCalled();
    expect(mockOnPickPoint).toHaveBeenCalledWith([2.35, 48.86]);
  });

  it("ignores empty-ground taps without onPickPoint (the filter)", async () => {
    await renderOnMap();
    expect(screen.getByText("place_picker_map_hint_select_only")).toBeOnTheScreen();
    expect(screen.queryByTestId("map-empty")).not.toBeOnTheScreen();
  });

  it("keeps the map for a first place when there are none yet", async () => {
    await renderOnMap({ options: [], onPickPoint: mockOnPickPoint });
    expect(screen.queryByText("no_options_available")).not.toBeOnTheScreen();
    expect(screen.getByTestId("places-map")).toBeOnTheScreen();
  });

  it("offline: no switch, only the list", async () => {
    mockOnline = false;
    await render(<SelectListModal {...mapProps()} />);

    expect(screen.queryByTestId("place-picker-view-map")).not.toBeOnTheScreen();
    expect(screen.queryByTestId("places-map")).not.toBeOnTheScreen();
    expect(screen.getByText("Pond")).toBeOnTheScreen();
  });

  it("reopens on the list even if it was closed on the map", async () => {
    await renderOnMap();
    expect(screen.getByTestId("places-map")).toBeOnTheScreen();

    await screen.rerender(<SelectListModal {...mapProps({ visible: false })} />);
    await screen.rerender(<SelectListModal {...mapProps()} />);
    expect(screen.queryByTestId("places-map")).not.toBeOnTheScreen();
    expect(screen.getByText("Pond")).toBeOnTheScreen();
  });

  it("falls back to the list when the connection drops with the map open", async () => {
    await renderOnMap();
    mockOnline = false;
    await screen.rerender(<SelectListModal {...mapProps()} />);
    expect(screen.queryByTestId("places-map")).not.toBeOnTheScreen();
    expect(screen.getByText("Pond")).toBeOnTheScreen();
  });
});
