jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("@gorhom/bottom-sheet", () => {
  const { ScrollView } = require("react-native");
  return { BottomSheetScrollView: ScrollView };
});
jest.mock("../../../util/storageHelper", () => ({ saveSort: jest.fn() }));

const mockRadioGroupCapture = jest.fn();
jest.mock("../../ui/RadioGroup", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockRadioGroupCapture(props);
    return null;
  },
}));

import { act, render } from "@testing-library/react-native";
import { saveSort } from "../../../util/storageHelper";
import SortSheetContent from "../SortSheetContent";

const mockSetSort = jest.fn();
const mockDismiss = jest.fn();
const mockOnLocationUnavailable = jest.fn();

const OPTIONS = [
  { label: "Distance asc", value: "distance" },
  { label: "Distance desc", value: "-distance" },
  { label: "Name", value: "name" },
];

const radioProps = () => mockRadioGroupCapture.mock.calls.at(-1)![0] as {
  value: string | null;
  onChange: (v: string | null) => void;
  disabledValues: string[];
  onDisabledPress: () => void;
};

const baseProps = (overrides: Record<string, unknown> = {}) => ({
  screen: "Places",
  options: OPTIONS,
  sort: "name",
  setSort: mockSetSort,
  dismiss: mockDismiss,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  (saveSort as jest.Mock).mockResolvedValue(undefined);
});

it("forwards sort/options to RadioGroup", async () => {
  await render(<SortSheetContent {...baseProps()} />);
  expect(radioProps().value).toBe("name");
});

describe("distance disabling", () => {
  it("disables distance options when location isn't available", async () => {
    await render(<SortSheetContent {...baseProps({ locationAvailable: false })} />);
    expect(radioProps().disabledValues).toEqual(["distance", "-distance"]);
  });

  it("leaves everything enabled when location is available (default)", async () => {
    await render(<SortSheetContent {...baseProps()} />);
    expect(radioProps().disabledValues).toEqual([]);
  });

  it("routes a disabled-option tap to onLocationUnavailable", async () => {
    await render(
      <SortSheetContent
        {...baseProps({ locationAvailable: false, onLocationUnavailable: mockOnLocationUnavailable })}
      />,
    );
    radioProps().onDisabledPress();
    expect(mockOnLocationUnavailable).toHaveBeenCalledTimes(1);
  });
});

describe("selecting a sort", () => {
  it("updates sort, persists it for the screen, and dismisses", async () => {
    await render(<SortSheetContent {...baseProps()} />);

    await act(async () => radioProps().onChange("-distance"));

    expect(mockSetSort).toHaveBeenCalledWith("-distance");
    expect(saveSort).toHaveBeenCalledWith("Places", "-distance");
    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });
});
