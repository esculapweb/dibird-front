jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => ({
    Colors: {
      textMain: "#000",
      border: "#ccc",
      primary100: "#fff",
      error500: "#f00",
      dropdownIcon: "#999",
      main100: "#0a0",
      yellow: "#ff0",
    },
  }),
}));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name, testID }: { name: string; testID?: string }) => (
      <Text testID={testID ?? `icon-${name}`}>{name}</Text>
    ),
  };
});
const mockModalCapture = jest.fn();
jest.mock("../SelectListModal", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockModalCapture(props);
    return null;
  },
}));
const mockSpeciesDropdownCapture = jest.fn();
jest.mock("../SpeciesDropdown", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockSpeciesDropdownCapture(props);
    return null;
  },
}));
const mockPlaceDropdownCapture = jest.fn();
jest.mock("../PlaceDropdown", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockPlaceDropdownCapture(props);
    return null;
  },
}));

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import DropdownInput from "../DropdownInput";
import { DropdownItem } from "../../../types";

const mockSetValue = jest.fn();
const mockRefetch = jest.fn();
const mockOnSortChange = jest.fn();

const OPTIONS: DropdownItem[] = [
  { value: 1, label: "France", icon: "🇫🇷" },
  { value: 2, label: "Germany", iconLabel: "star" },
];

const baseQuery = (overrides: Record<string, unknown> = {}) => ({
  data: OPTIONS,
  isLoading: false,
  isError: false,
  refetch: mockRefetch,
  ...overrides,
});

const modalProps = () => mockModalCapture.mock.calls.at(-1)![0];

beforeEach(() => {
  jest.clearAllMocks();
});

describe("default trigger rendering", () => {
  it("shows the placeholder (or a translated default) when nothing is selected", async () => {
    await render(<DropdownInput value={null} setValue={mockSetValue} query={baseQuery()} placeholder="Pick one" />);
    expect(screen.getByText("Pick one")).toBeOnTheScreen();

    await render(<DropdownInput value={null} setValue={mockSetValue} query={baseQuery()} />);
    expect(screen.getByText("select")).toBeOnTheScreen();
  });

  it("shows the title, marking it as an error when one is present", async () => {
    await render(<DropdownInput value={null} setValue={mockSetValue} query={baseQuery()} title="Country" error="Required" />);
    expect(screen.getByText("Country")).toBeOnTheScreen();
    expect(screen.getByText("Required")).toBeOnTheScreen();
  });

  it("shows the matching option's label once value resolves against loaded data", async () => {
    await render(<DropdownInput value={1} setValue={mockSetValue} query={baseQuery()} />);
    expect(screen.getByText("France")).toBeOnTheScreen();
    expect(screen.getByText("🇫🇷")).toBeOnTheScreen();
  });

  it("shows an iconLabel icon for an option that has one instead of a text icon", async () => {
    await render(<DropdownInput value={2} setValue={mockSetValue} query={baseQuery()} />);
    expect(screen.getByTestId("icon-star")).toBeOnTheScreen();
  });

  it("falls back to the placeholder when the value has no matching option yet", async () => {
    await render(<DropdownInput value={999} setValue={mockSetValue} query={baseQuery()} placeholder="Pick one" />);
    expect(screen.getByText("Pick one")).toBeOnTheScreen();
  });

  it("re-resolves the label once the query data arrives after the value was already set", async () => {
    await render(<DropdownInput value={1} setValue={mockSetValue} query={baseQuery({ data: undefined })} placeholder="Pick one" />);
    expect(screen.getByText("Pick one")).toBeOnTheScreen();

    await render(<DropdownInput value={1} setValue={mockSetValue} query={baseQuery()} placeholder="Pick one" />);
    expect(screen.getByText("France")).toBeOnTheScreen();
  });

  it("sets a distinct trigger testID keyed by type", async () => {
    await render(<DropdownInput value={null} setValue={mockSetValue} query={baseQuery()} type="CountriesDropdown" useDefault />);
    expect(screen.getByTestId("dropdown-trigger-CountriesDropdown")).toBeOnTheScreen();
  });
});

describe("loading / error states", () => {
  it("shows a loading label and spinner, hiding the icon/label/chevron", async () => {
    await render(<DropdownInput value={1} setValue={mockSetValue} query={baseQuery({ isLoading: true })} />);
    expect(screen.getByText("loading_")).toBeOnTheScreen();
    expect(screen.queryByText("France")).not.toBeOnTheScreen();
    expect(screen.queryByTestId("icon-chevron-down")).not.toBeOnTheScreen();
  });

  it("shows an error label and a retry button wired to query.refetch", async () => {
    await render(<DropdownInput value={1} setValue={mockSetValue} query={baseQuery({ isError: true })} />);
    expect(screen.getByText("failed_to_load_data")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("icon-refresh"));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("omits the retry button when the query has no refetch function", async () => {
    await render(
      <DropdownInput value={1} setValue={mockSetValue} query={baseQuery({ isError: true, refetch: undefined })} />,
    );
    expect(screen.queryByTestId("icon-refresh")).not.toBeOnTheScreen();
  });
});

describe("disabled state", () => {
  it("shows the lock icon and disabledMessage instead of the placeholder when there's no label yet", async () => {
    await render(
      <DropdownInput value={null} setValue={mockSetValue} query={baseQuery()} disabled disabledMessage="Pick a territory first" />,
    );
    expect(screen.getByText("Pick a territory first")).toBeOnTheScreen();
    expect(screen.getByTestId("icon-lock-closed")).toBeOnTheScreen();
  });

  it("still shows the resolved label when disabled but a value is set", async () => {
    await render(<DropdownInput value={1} setValue={mockSetValue} query={baseQuery()} disabled />);
    expect(screen.getByText("France")).toBeOnTheScreen();
  });

  it("does not open the modal when pressed", async () => {
    await render(<DropdownInput value={null} setValue={mockSetValue} query={baseQuery()} disabled placeholder="Pick one" />);
    await fireEvent.press(screen.getByText("Pick one"));
    expect(modalProps().visible).toBe(false);
  });
});

describe("opening the modal", () => {
  it("opens on press when enabled, loaded, and not locating", async () => {
    await render(<DropdownInput value={null} setValue={mockSetValue} query={baseQuery()} placeholder="Pick one" />);
    await fireEvent.press(screen.getByText("Pick one"));
    expect(modalProps().visible).toBe(true);
  });

  it("does not open while the query is loading", async () => {
    await render(<DropdownInput value={null} setValue={mockSetValue} query={baseQuery({ isLoading: true })} />);
    await fireEvent.press(screen.getByText("loading_"));
    expect(modalProps().visible).toBe(false);
  });

  it("does not open while the query is in error", async () => {
    await render(<DropdownInput value={null} setValue={mockSetValue} query={baseQuery({ isError: true })} />);
    await fireEvent.press(screen.getByText("failed_to_load_data"));
    expect(modalProps().visible).toBe(false);
  });

  it("does not open while isLocating", async () => {
    await render(<DropdownInput value={null} setValue={mockSetValue} query={baseQuery()} isLocating placeholder="Pick one" />);
    await fireEvent.press(screen.getByText("Pick one"));
    expect(modalProps().visible).toBe(false);
  });
});

describe("selecting from the modal", () => {
  it("sets the value and resolves the label/icon from the matching option, then closes", async () => {
    await render(<DropdownInput value={null} setValue={mockSetValue} query={baseQuery()} placeholder="Pick one" />);
    await fireEvent.press(screen.getByText("Pick one"));

    await act(async () => {
      modalProps().onSelect(2);
    });

    expect(mockSetValue).toHaveBeenCalledWith(2);
    await screen.findByText("Germany");
    expect(modalProps().visible).toBe(false);
  });

  it("clears label/icon when the selected value has no matching option", async () => {
    await render(<DropdownInput value={1} setValue={mockSetValue} query={baseQuery()} placeholder="Pick one" />);
    await act(async () => {
      modalProps().onSelect(999);
    });

    expect(mockSetValue).toHaveBeenCalledWith(999);
    await screen.findByText("Pick one");
  });
});

describe("clear button", () => {
  it("shows only when there's a value, allowReset is set, and it's enabled/loaded", async () => {
    await render(<DropdownInput value={1} setValue={mockSetValue} query={baseQuery()} />);
    expect(screen.queryByTestId("icon-close-circle")).not.toBeOnTheScreen();

    await render(<DropdownInput value={1} setValue={mockSetValue} query={baseQuery()} allowReset />);
    expect(screen.getByTestId("icon-close-circle")).toBeOnTheScreen();
  });

  it("clears the value, label and icon when pressed", async () => {
    await render(<DropdownInput value={1} setValue={mockSetValue} query={baseQuery()} allowReset placeholder="Pick one" />);
    await fireEvent.press(screen.getByTestId("icon-close-circle"));

    expect(mockSetValue).toHaveBeenCalledWith(null);
    await screen.findByText("Pick one");
  });
});

describe("specialized dropdown delegation", () => {
  it("delegates to SpeciesDropdown for type=SpeciesDropdown", async () => {
    await render(<DropdownInput value={null} setValue={mockSetValue} query={baseQuery()} type="SpeciesDropdown" />);
    expect(mockSpeciesDropdownCapture).toHaveBeenCalled();
    expect(screen.queryByTestId("dropdown-trigger-SpeciesDropdown")).not.toBeOnTheScreen();
  });

  it("delegates to PlaceDropdown for type=PlacesDropdown", async () => {
    await render(<DropdownInput value={null} setValue={mockSetValue} query={baseQuery()} type="PlacesDropdown" />);
    expect(mockPlaceDropdownCapture).toHaveBeenCalled();
  });

  it("falls back to the plain trigger for those same types when useDefault is set", async () => {
    await render(
      <DropdownInput value={null} setValue={mockSetValue} query={baseQuery()} type="SpeciesDropdown" useDefault placeholder="Pick one" />,
    );
    expect(mockSpeciesDropdownCapture).not.toHaveBeenCalled();
    expect(screen.getByText("Pick one")).toBeOnTheScreen();
  });
});

describe("SelectListModal wiring", () => {
  it("forwards sort/onSortChange/location props through untouched", async () => {
    await render(
      <DropdownInput
        value={null}
        setValue={mockSetValue}
        query={baseQuery()}
        sort="name"
        onSortChange={mockOnSortChange}
        locationAvailable={false}
      />,
    );
    expect(modalProps().sort).toBe("name");
    expect(modalProps().onSortChange).toBe(mockOnSortChange);
    expect(modalProps().locationAvailable).toBe(false);
  });

  it("resets the search text each time the modal is reopened", async () => {
    await render(<DropdownInput value={null} setValue={mockSetValue} query={baseQuery()} placeholder="Pick one" />);
    await act(async () => {
      modalProps().setSearch("fra");
    });
    await fireEvent.press(screen.getByText("Pick one"));
    expect(modalProps().search).toBe("");
  });
});
