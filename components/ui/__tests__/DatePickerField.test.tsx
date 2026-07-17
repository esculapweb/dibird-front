jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
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
import DatePickerField from "../DatePickerField";

const mockSetDate = jest.fn();
const originalOS = Platform.OS;

const pickerProps = () => mockPickerCapture.mock.calls.at(-1)![0] as {
  value: Date;
  onChange: (e: unknown, selectedDate: Date | undefined) => void;
};

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  Platform.OS = originalOS;
});

it("shows a dash placeholder when there's no date", async () => {
  await render(<DatePickerField label="Born" date={null} setDate={mockSetDate} />);
  expect(screen.getByText("Born")).toBeOnTheScreen();
  expect(screen.getByText("—")).toBeOnTheScreen();
});

it("formats a given date, localized", async () => {
  await render(<DatePickerField label="Born" date="2026-03-05" setDate={mockSetDate} />);
  expect(screen.getByText(new Date("2026-03-05T00:00:00").toLocaleDateString())).toBeOnTheScreen();
});

describe("picker visibility", () => {
  it("is hidden until the field is pressed", async () => {
    await render(<DatePickerField label="Born" date={null} setDate={mockSetDate} />);
    expect(screen.queryByTestId("date-time-picker")).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("date-picker-field-button"));
    expect(screen.getByTestId("date-time-picker")).toBeOnTheScreen();
  });
});

describe("picker value", () => {
  it("seeds the picker at midnight local time for a given date string", async () => {
    await render(<DatePickerField label="Born" date="2026-03-05" setDate={mockSetDate} />);
    await fireEvent.press(screen.getByTestId("date-picker-field-button"));

    const value = pickerProps().value;
    expect(value.getFullYear()).toBe(2026);
    expect(value.getMonth()).toBe(2);
    expect(value.getDate()).toBe(5);
    expect(value.getHours()).toBe(0);
  });

  it("defaults to today when there's no date yet", async () => {
    await render(<DatePickerField label="Born" date={null} setDate={mockSetDate} />);
    await fireEvent.press(screen.getByTestId("date-picker-field-button"));

    const value = pickerProps().value;
    const now = new Date();
    expect(value.getFullYear()).toBe(now.getFullYear());
    expect(value.getMonth()).toBe(now.getMonth());
    expect(value.getDate()).toBe(now.getDate());
  });
});

describe("onChange", () => {
  it("calls setDate with a YYYY-MM-DD string when a date is picked", async () => {
    await render(<DatePickerField label="Born" date={null} setDate={mockSetDate} />);
    await fireEvent.press(screen.getByTestId("date-picker-field-button"));

    await act(async () => {
      pickerProps().onChange({}, new Date(2025, 11, 25));
    });
    expect(mockSetDate).toHaveBeenCalledWith("2025-12-25");
  });

  it("does not call setDate when the user cancels (no selectedDate)", async () => {
    await render(<DatePickerField label="Born" date={null} setDate={mockSetDate} />);
    await fireEvent.press(screen.getByTestId("date-picker-field-button"));

    await act(async () => {
      pickerProps().onChange({}, undefined);
    });
    expect(mockSetDate).not.toHaveBeenCalled();
  });

  it("hides the picker after a change on Android, but keeps it open on iOS", async () => {
    Platform.OS = "android";
    await render(<DatePickerField label="Born" date={null} setDate={mockSetDate} />);
    await fireEvent.press(screen.getByTestId("date-picker-field-button"));
    await act(async () => {
      pickerProps().onChange({}, new Date(2025, 11, 25));
    });
    expect(screen.queryByTestId("date-time-picker")).not.toBeOnTheScreen();

    Platform.OS = "ios";
    await render(<DatePickerField label="Born" date={null} setDate={mockSetDate} />);
    await fireEvent.press(screen.getByTestId("date-picker-field-button"));
    await act(async () => {
      pickerProps().onChange({}, new Date(2025, 11, 25));
    });
    expect(screen.getByTestId("date-time-picker")).toBeOnTheScreen();
  });
});
