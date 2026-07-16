jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => ({
    Colors: {
      textMain: "#000",
      textSecondary: "#666",
      border: "#ccc",
      primary100: "#fff",
      primary200: "#eee",
      main100: "#0a0",
      error500: "#f00",
      dropdownIcon: "#999",
    },
    theme: "light",
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
jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light" },
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
import TimeInput from "../TimeInput";

const mockOnChange = jest.fn();
const originalOS = Platform.OS;
const latestPickerProps = () => mockPickerCapture.mock.calls.at(-1)![0];

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = originalOS;
});

afterEach(() => {
  Platform.OS = originalOS;
});

it("shows the placeholder without a value, the formatted time with one", async () => {
  await render(<TimeInput value="" onChange={mockOnChange} />);
  expect(screen.getByText("select_time")).toBeOnTheScreen();

  await render(<TimeInput value="9:5:00" onChange={mockOnChange} />);
  expect(screen.getByText("09:05")).toBeOnTheScreen();
});

it("shows the error message only while the picker is closed", async () => {
  await render(<TimeInput value="" onChange={mockOnChange} error="Required" />);
  expect(screen.getByText("Required")).toBeOnTheScreen();
});

it("does not open the picker or fire haptics when disabled", async () => {
  Platform.OS = "android";
  await render(<TimeInput value="" onChange={mockOnChange} disabled />);
  await fireEvent.press(screen.getByText("select_time"));

  expect(Haptics.selectionAsync).not.toHaveBeenCalled();
  expect(screen.queryByTestId("date-time-picker")).not.toBeOnTheScreen();
});

describe("clear button", () => {
  it("shows only with a value, allowClear, and not disabled", async () => {
    await render(<TimeInput value="" onChange={mockOnChange} />);
    expect(screen.queryByTestId("icon-close-circle")).not.toBeOnTheScreen();

    await render(<TimeInput value="09:00" onChange={mockOnChange} allowClear={false} />);
    expect(screen.queryByTestId("icon-close-circle")).not.toBeOnTheScreen();

    await render(<TimeInput value="09:00" onChange={mockOnChange} />);
    expect(screen.getByTestId("icon-close-circle")).toBeOnTheScreen();
  });

  it("clears the value and fires an impact haptic when pressed", async () => {
    await render(<TimeInput value="09:00" onChange={mockOnChange} />);
    await fireEvent.press(screen.getByTestId("icon-close-circle"));

    expect(mockOnChange).toHaveBeenCalledWith(null);
    expect(Haptics.impactAsync).toHaveBeenCalledWith("light");
  });
});

describe("Android", () => {
  beforeEach(() => {
    Platform.OS = "android";
  });

  it("opens the native picker on press, with a selection haptic", async () => {
    await render(<TimeInput value="" onChange={mockOnChange} />);
    await fireEvent.press(screen.getByText("select_time"));

    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("date-time-picker")).toBeOnTheScreen();
    expect(latestPickerProps().is24Hour).toBe(true);
  });

  it("applies the picked time and closes on a 'set' event", async () => {
    await render(<TimeInput value="" onChange={mockOnChange} />);
    await fireEvent.press(screen.getByText("select_time"));

    const { onChange } = latestPickerProps();
    await act(async () => {
      onChange({ type: "set" }, new Date(2026, 0, 1, 14, 30, 0));
    });

    await screen.findByText("select_time");
    expect(mockOnChange).toHaveBeenCalledWith("14:30:00");
    expect(screen.queryByTestId("date-time-picker")).not.toBeOnTheScreen();
  });

  it("discards the selection and closes without calling onChange on dismissal", async () => {
    await render(<TimeInput value="" onChange={mockOnChange} />);
    await fireEvent.press(screen.getByText("select_time"));

    const { onChange } = latestPickerProps();
    await act(async () => {
      onChange({ type: "dismissed" }, undefined);
    });

    await screen.findByText("select_time");
    expect(mockOnChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId("date-time-picker")).not.toBeOnTheScreen();
  });
});

describe("iOS", () => {
  beforeEach(() => {
    Platform.OS = "ios";
  });

  it("opens an inline panel on press, with a selection haptic", async () => {
    await render(<TimeInput value="09:00" onChange={mockOnChange} />);
    await fireEvent.press(screen.getByText("09:00"));

    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("date-time-picker")).toBeOnTheScreen();
    expect(screen.getByText("done")).toBeOnTheScreen();
  });

  it("immediately commits the current time when opened without an existing value", async () => {
    await render(<TimeInput value="" onChange={mockOnChange} />);
    await fireEvent.press(screen.getByText("select_time"));
    expect(mockOnChange).toHaveBeenCalledTimes(1);
  });

  it("does not re-commit on open when a value is already set", async () => {
    await render(<TimeInput value="09:00" onChange={mockOnChange} />);
    await fireEvent.press(screen.getByText("09:00"));
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it("applies the time live as the spinner changes, without closing the panel", async () => {
    await render(<TimeInput value="09:00" onChange={mockOnChange} />);
    await fireEvent.press(screen.getByText("09:00"));

    const { onChange } = latestPickerProps();
    await act(async () => {
      onChange({} as never, new Date(2026, 0, 1, 16, 45, 0));
    });

    expect(mockOnChange).toHaveBeenCalledWith("16:45:00");
    expect(screen.getByTestId("date-time-picker")).toBeOnTheScreen();
  });

  it("closes the panel on 'done' without calling onChange again", async () => {
    await render(<TimeInput value="09:00" onChange={mockOnChange} />);
    await fireEvent.press(screen.getByText("09:00"));
    mockOnChange.mockClear();

    await fireEvent.press(screen.getByText("done"));
    expect(mockOnChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId("date-time-picker")).not.toBeOnTheScreen();
  });
});
