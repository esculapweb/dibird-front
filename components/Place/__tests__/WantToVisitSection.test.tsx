jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon-${name}`}</Text> };
});
jest.mock("../../ui/DateInput", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockDateInputCapture(props);
    return props.trailing;
  },
}));
jest.mock("../../ui/TimeChip", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockTimeChipCapture(props);
    return null;
  },
}));

import { fireEvent, render, screen } from "@testing-library/react-native";
import WantToVisitSection from "../WantToVisitSection";

const mockDateInputCapture = jest.fn();
const mockTimeChipCapture = jest.fn();

const renderSection = (value: boolean, overrides: { reminderError?: string | null } = {}) => {
  const props = {
    value,
    onChange: jest.fn(),
    reminderDate: "2099-05-01",
    reminderTime: "10:00:00",
    onReminderDateChange: jest.fn(),
    onReminderTimeChange: jest.fn(),
    ...overrides,
  };
  return { props, result: render(<WantToVisitSection {...props} />) };
};

beforeEach(() => {
  jest.clearAllMocks();
});

// A reminder for a place the user does not plan to visit makes no sense.
it("hides the reminder fields while the switch is off", async () => {
  const { result } = renderSection(false);
  await result;

  expect(screen.getByText("icon-flag-outline")).toBeOnTheScreen();
  expect(mockDateInputCapture).not.toHaveBeenCalled();
});

it("toggles from the whole row and from the switch", async () => {
  const { props, result } = renderSection(false);
  await result;

  await fireEvent.press(screen.getByTestId("place-want-to-visit-toggle"));
  expect(props.onChange).toHaveBeenCalledWith(true);

  await fireEvent(screen.getByRole("switch"), "valueChange", true);
  expect(props.onChange).toHaveBeenLastCalledWith(true);
});

it("shows the reminder fields with their values while the switch is on", async () => {
  const { props, result } = renderSection(true, { reminderError: "reminder_in_past" });
  await result;

  expect(screen.getByText("icon-flag")).toBeOnTheScreen();
  const dateInput = mockDateInputCapture.mock.calls.at(-1)[0];
  expect(dateInput).toMatchObject({
    value: "2099-05-01",
    error: "reminder_in_past",
    onChange: props.onReminderDateChange,
  });
  expect(mockTimeChipCapture.mock.calls.at(-1)[0]).toMatchObject({
    value: "10:00:00",
    onChange: props.onReminderTimeChange,
  });

  await fireEvent.press(screen.getByTestId("place-want-to-visit-toggle"));
  expect(props.onChange).toHaveBeenCalledWith(false);
});
