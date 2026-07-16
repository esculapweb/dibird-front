jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
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
      main300: "#0f0",
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
import DateInput from "../DateInput";

const mockOnChange = jest.fn();
const originalOS = Platform.OS;
const latestPickerProps = () => mockPickerCapture.mock.calls.at(-1)![0];
const formatEn = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric" });

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = originalOS;
});

afterEach(() => {
  Platform.OS = originalOS;
});

it("shows the placeholder without a value, the formatted date with one", async () => {
  await render(<DateInput value={null} onChange={mockOnChange} placeholder="Pick a date" error={false} />);
  expect(screen.getByText("Pick a date")).toBeOnTheScreen();

  await render(<DateInput value="2026-03-15" onChange={mockOnChange} placeholder="Pick a date" error={false} />);
  expect(screen.getByText(formatEn("2026-03-15"))).toBeOnTheScreen();
});

it("shows the error message only while the picker is closed", async () => {
  await render(<DateInput value={null} onChange={mockOnChange} placeholder="x" error="Required" />);
  expect(screen.getByText("Required")).toBeOnTheScreen();
});

it("does not open the picker or fire haptics when disabled", async () => {
  Platform.OS = "android";
  await render(<DateInput value={null} onChange={mockOnChange} placeholder="x" error={false} disabled />);
  await fireEvent.press(screen.getByText("x"));

  expect(Haptics.selectionAsync).not.toHaveBeenCalled();
  expect(screen.queryByTestId("date-time-picker")).not.toBeOnTheScreen();
});

describe("clear button", () => {
  it("shows only with a value, allowClear, and not disabled", async () => {
    await render(<DateInput value={null} onChange={mockOnChange} placeholder="x" error={false} />);
    expect(screen.queryByTestId("icon-close-circle")).not.toBeOnTheScreen();

    await render(<DateInput value="2026-01-01" onChange={mockOnChange} placeholder="x" error={false} allowClear={false} />);
    expect(screen.queryByTestId("icon-close-circle")).not.toBeOnTheScreen();

    await render(<DateInput value="2026-01-01" onChange={mockOnChange} placeholder="x" error={false} />);
    expect(screen.getByTestId("icon-close-circle")).toBeOnTheScreen();
  });

  it("clears the value and fires an impact haptic when pressed", async () => {
    await render(<DateInput value="2026-01-01" onChange={mockOnChange} placeholder="x" error={false} />);
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
    await render(<DateInput value={null} onChange={mockOnChange} placeholder="Pick a date" error={false} />);
    await fireEvent.press(screen.getByText("Pick a date"));

    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("date-time-picker")).toBeOnTheScreen();
  });

  it("applies the picked date and closes on a 'set' event", async () => {
    await render(<DateInput value={null} onChange={mockOnChange} placeholder="Pick a date" error={false} />);
    await fireEvent.press(screen.getByText("Pick a date"));

    const { onChange } = latestPickerProps();
    await act(async () => {
      onChange({ type: "set" }, new Date("2026-05-01T00:00:00"));
    });

    await screen.findByText("Pick a date");
    expect(mockOnChange).toHaveBeenCalledWith("2026-05-01");
    expect(screen.queryByTestId("date-time-picker")).not.toBeOnTheScreen();
  });

  it("discards the selection and closes without calling onChange on dismissal", async () => {
    await render(<DateInput value={null} onChange={mockOnChange} placeholder="Pick a date" error={false} />);
    await fireEvent.press(screen.getByText("Pick a date"));

    const { onChange } = latestPickerProps();
    await act(async () => {
      onChange({ type: "dismissed" }, undefined);
    });

    await screen.findByText("Pick a date");
    expect(mockOnChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId("date-time-picker")).not.toBeOnTheScreen();
  });

  it("forwards a minimumDate only when one is provided", async () => {
    await render(<DateInput value={null} onChange={mockOnChange} placeholder="x" error={false} minimumDate="2026-01-01" />);
    await fireEvent.press(screen.getByText("x"));
    expect(latestPickerProps().minimumDate).toEqual(new Date("2026-01-01T00:00:00"));
  });
});

describe("iOS", () => {
  beforeEach(() => {
    Platform.OS = "ios";
  });

  it("opens an inline panel on press, with a selection haptic", async () => {
    await render(<DateInput value={null} onChange={mockOnChange} placeholder="Pick a date" error={false} />);
    await fireEvent.press(screen.getByText("Pick a date"));

    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("date-time-picker")).toBeOnTheScreen();
    expect(screen.getByText("today")).toBeOnTheScreen();
    expect(screen.getByText("done")).toBeOnTheScreen();
  });

  it("applies the date live as the spinner changes, without closing the panel", async () => {
    await render(<DateInput value={null} onChange={mockOnChange} placeholder="Pick a date" error={false} />);
    await fireEvent.press(screen.getByText("Pick a date"));

    const { onChange } = latestPickerProps();
    await act(async () => {
      onChange({} as never, new Date("2026-06-15T00:00:00"));
    });

    expect(mockOnChange).toHaveBeenCalledWith("2026-06-15");
    expect(screen.getByTestId("date-time-picker")).toBeOnTheScreen();
  });

  it("jumps to today and applies it immediately when 'today' is pressed", async () => {
    await render(<DateInput value={null} onChange={mockOnChange} placeholder="Pick a date" error={false} />);
    await fireEvent.press(screen.getByText("Pick a date"));
    await fireEvent.press(screen.getByText("today"));

    expect(mockOnChange).toHaveBeenCalled();
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(2);
  });

  it("commits the still-uncommitted temp date on 'done' when nothing was explicitly picked yet", async () => {
    await render(<DateInput value={null} onChange={mockOnChange} placeholder="Pick a date" error={false} />);
    await fireEvent.press(screen.getByText("Pick a date"));
    await fireEvent.press(screen.getByText("done"));

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("date-time-picker")).not.toBeOnTheScreen();
  });

  it("does not double-commit on 'done' once a value is already set", async () => {
    await render(<DateInput value="2026-01-01" onChange={mockOnChange} placeholder="Pick a date" error={false} />);
    await fireEvent.press(screen.getByText(formatEn("2026-01-01")));
    await fireEvent.press(screen.getByText("done"));

    expect(mockOnChange).not.toHaveBeenCalled();
  });
});
