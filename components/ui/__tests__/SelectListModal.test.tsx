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

  it("has no toggle unless allowed", async () => {
    await render(<SelectListModal {...baseProps()} />);
    expect(screen.queryByTestId("select-multiple-toggle")).toBeNull();
  });

  it("shows the switch row with the caller's label and switches back when turned off", async () => {
    await render(<SelectListModal {...multiProps({ multipleLabel: "Pick several" })} />);
    expect(screen.getByText("Pick several")).toBeTruthy();
    expect(screen.getByTestId("select-multiple-switch").props.value).toBe(false);

    await act(async () => fireEvent(screen.getByTestId("select-multiple-switch"), "valueChange", true));
    expect(screen.getByTestId("select-multiple-switch").props.value).toBe(true);
    expect(screen.getByTestId("select-multiple-done")).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByTestId("select-multiple-toggle")));
    expect(screen.queryByTestId("select-multiple-done")).toBeNull();
    await act(async () => fireEvent.press(screen.getByTestId("row-2")));
    expect(mockOnSelect).toHaveBeenCalledWith(2);
  });

  it("checks rows instead of picking them and confirms the set in tap order", async () => {
    await render(<SelectListModal {...multiProps()} />);

    await act(async () => fireEvent.press(screen.getByTestId("select-multiple-toggle")));
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

    await act(async () => fireEvent.press(screen.getByTestId("select-multiple-toggle")));
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
