jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => ({
    Colors: {
      textMain: "#000",
      textSecondary: "#666",
      textOpposite: "#fff",
      border: "#ccc",
      primary100: "#fff",
      main100: "#0a0",
      main300: "#efe",
      error600: "#f00",
      dropdownIcon: "#999",
    },
    theme: "light",
  }),
}));
jest.mock("@gorhom/bottom-sheet", () => {
  const { View } = require("react-native");
  return { BottomSheetView: View };
});
jest.mock("react-native-gesture-handler", () => ({
  Gesture: { Native: () => ({ shouldCancelWhenOutside: () => ({}) }) },
  GestureDetector: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name, testID }: { name: string; testID?: string }) => (
      <Text testID={testID ?? `icon-${name}`}>{name}</Text>
    ),
  };
});
jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light" },
}));
jest.mock("../../../services/bottomSheet", () => ({
  BottomSheet: { showContent: jest.fn() },
}));
const mockPickerCapture = jest.fn();
jest.mock("@react-native-community/datetimepicker", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      mockPickerCapture(props);
      return <View testID="date-time-picker" />;
    },
  };
});

import { Platform } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { BottomSheet } from "../../../services/bottomSheet";
import TimeChip from "../TimeChip";

const mockOnChange = jest.fn();
const mockDismiss = jest.fn();
const originalOS = Platform.OS;
const latestPickerProps = () => mockPickerCapture.mock.calls.at(-1)![0];

// What the chip handed to the global sheet — rendering it is what the sheet
// itself does, only without the sheet.
const sheetPayload = () =>
  (BottomSheet.showContent as jest.Mock).mock.calls.at(-1)![0];

const renderSheet = async () =>
  render(sheetPayload().renderContent(mockDismiss));

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = originalOS;
});

afterEach(() => {
  Platform.OS = originalOS;
});

it("invites a time when empty and shows the formatted one when set", async () => {
  await render(<TimeChip value={null} onChange={mockOnChange} />);
  expect(screen.getByText("add_time")).toBeOnTheScreen();

  await render(<TimeChip value="9:5:00" onChange={mockOnChange} />);
  expect(screen.getByText("09:05")).toBeOnTheScreen();
});

it("does nothing when disabled", async () => {
  Platform.OS = "android";
  await render(<TimeChip value={null} onChange={mockOnChange} disabled />);
  await fireEvent.press(screen.getByText("add_time"));

  expect(Haptics.selectionAsync).not.toHaveBeenCalled();
  expect(screen.queryByTestId("date-time-picker")).not.toBeOnTheScreen();
});

describe("clear button", () => {
  it("shows only with a value and not disabled", async () => {
    await render(<TimeChip value={null} onChange={mockOnChange} />);
    expect(screen.queryByTestId("icon-close-circle")).not.toBeOnTheScreen();

    await render(<TimeChip value="09:00" onChange={mockOnChange} disabled />);
    expect(screen.queryByTestId("icon-close-circle")).not.toBeOnTheScreen();

    await render(<TimeChip value="09:00" onChange={mockOnChange} />);
    expect(screen.getByTestId("icon-close-circle")).toBeOnTheScreen();
  });

  it("clears the value and fires an impact haptic when pressed", async () => {
    await render(<TimeChip value="09:00" onChange={mockOnChange} />);
    await fireEvent.press(screen.getByTestId("icon-close-circle"));

    expect(mockOnChange).toHaveBeenCalledWith(null);
    expect(Haptics.impactAsync).toHaveBeenCalledWith("light");
  });
});

describe("Android", () => {
  beforeEach(() => {
    Platform.OS = "android";
  });

  it("opens the native dialog rather than the sheet — it cannot live inside one", async () => {
    await render(<TimeChip value={null} onChange={mockOnChange} />);
    await fireEvent.press(screen.getByText("add_time"));

    expect(BottomSheet.showContent).not.toHaveBeenCalled();
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("date-time-picker")).toBeOnTheScreen();
    expect(latestPickerProps().is24Hour).toBe(true);
  });

  it("applies the picked time and closes on a 'set' event", async () => {
    await render(<TimeChip value={null} onChange={mockOnChange} />);
    await fireEvent.press(screen.getByText("add_time"));

    await act(async () => {
      latestPickerProps().onChange(
        { type: "set" },
        new Date(2026, 0, 1, 14, 30, 0),
      );
    });

    expect(mockOnChange).toHaveBeenCalledWith("14:30:00");
    expect(screen.queryByTestId("date-time-picker")).not.toBeOnTheScreen();
  });

  it("leaves the field untouched when the dialog is dismissed", async () => {
    await render(<TimeChip value={null} onChange={mockOnChange} />);
    await fireEvent.press(screen.getByText("add_time"));

    await act(async () => {
      latestPickerProps().onChange({ type: "dismissed" }, undefined);
    });

    expect(mockOnChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId("date-time-picker")).not.toBeOnTheScreen();
  });
});

describe("iOS", () => {
  beforeEach(() => {
    Platform.OS = "ios";
  });

  it("opens the time sheet with the sheet's own panning off", async () => {
    await render(<TimeChip value={null} onChange={mockOnChange} />);
    await fireEvent.press(screen.getByText("add_time"));

    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(sheetPayload()).toMatchObject({ disableContentPanning: true });
    // The title is drawn by the content, not handed to the sheet: a second
    // measured node would fight the sheet's own height (see TimeChip).
    expect(sheetPayload().title).toBeUndefined();

    await renderSheet();
    expect(screen.getByText("select_time")).toBeOnTheScreen();
  });

  it("writes nothing to the form just by being opened", async () => {
    await render(<TimeChip value={null} onChange={mockOnChange} />);
    await fireEvent.press(screen.getByText("add_time"));
    await renderSheet();

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it("commits the spun time only on 'done', then closes", async () => {
    await render(<TimeChip value="09:00" onChange={mockOnChange} />);
    await fireEvent.press(screen.getByText("09:00"));
    await renderSheet();

    await act(async () => {
      latestPickerProps().onChange({}, new Date(2026, 0, 1, 16, 45, 0));
    });
    expect(mockOnChange).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId("time-sheet-done"));
    expect(mockOnChange).toHaveBeenCalledWith("16:45:00");
    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });

  it("'now' fills the spinner, and 'done' commits it", async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 4, 2, 7, 8, 0));
    await render(<TimeChip value={null} onChange={mockOnChange} />);
    await fireEvent.press(screen.getByText("add_time"));
    await renderSheet();

    await fireEvent.press(screen.getByTestId("time-sheet-now"));
    await fireEvent.press(screen.getByTestId("time-sheet-done"));

    expect(mockOnChange).toHaveBeenCalledWith("07:08:00");
    jest.useRealTimers();
  });

  it("offers 'clear' only when there is a time to clear", async () => {
    await render(<TimeChip value={null} onChange={mockOnChange} />);
    await fireEvent.press(screen.getByText("add_time"));
    await renderSheet();
    expect(screen.queryByTestId("time-sheet-clear")).not.toBeOnTheScreen();

    await render(<TimeChip value="09:00" onChange={mockOnChange} />);
    await fireEvent.press(screen.getByText("09:00"));
    await renderSheet();

    await fireEvent.press(screen.getByTestId("time-sheet-clear"));
    expect(mockOnChange).toHaveBeenCalledWith(null);
    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });
});
