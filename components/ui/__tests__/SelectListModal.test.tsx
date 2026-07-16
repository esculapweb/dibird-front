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
