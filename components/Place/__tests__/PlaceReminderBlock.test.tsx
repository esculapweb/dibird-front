jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { date?: string }) => (opts?.date ? `${key}:${opts.date}` : key),
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
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

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import PlaceReminderBlock from "../PlaceReminderBlock";
import { formatDateTime } from "../../../util/helpers";

const mockDateInputCapture = jest.fn();
const mockTimeChipCapture = jest.fn();

// Far enough from "now" in either direction that the test never straddles it.
const FUTURE = "2099-05-01T10:00:00.000Z";
const PAST = "2000-05-01T10:00:00.000Z";

const lastDateInput = () => mockDateInputCapture.mock.calls.at(-1)[0];
const lastTimeChip = () => mockTimeChipCapture.mock.calls.at(-1)[0];

const pick = async (date: string, time: string) => {
  await act(async () => lastDateInput().onChange(date));
  await act(async () => lastTimeChip().onChange(time));
};

beforeEach(() => {
  jest.clearAllMocks();
});

it("offers nothing to save or delete until both a date and a time are picked", async () => {
  const onSave = jest.fn();
  await render(<PlaceReminderBlock reminderAt={null} onSave={onSave} />);

  expect(screen.queryByText("delete_reminder")).toBeNull();
  expect(screen.queryByText("set_reminder")).toBeNull();

  await act(async () => lastDateInput().onChange("2099-06-02"));
  expect(screen.queryByText("set_reminder")).toBeNull();

  await act(async () => lastTimeChip().onChange("08:30:00"));
  await fireEvent.press(screen.getByText("set_reminder"));
  expect(onSave).toHaveBeenCalledWith("2099-06-02T08:30:00.000Z");
});

it("seeds the fields from the stored reminder and shows when it fires", async () => {
  await render(<PlaceReminderBlock reminderAt={FUTURE} onSave={jest.fn()} />);

  expect(lastDateInput().value).toBe("2099-05-01");
  expect(lastTimeChip().value).toBe("10:00:00");
  expect(screen.getByText(formatDateTime(FUTURE))).toBeOnTheScreen();
  // Unchanged — saving the same moment again would be a no-op request.
  expect(screen.queryByText("set_reminder")).toBeNull();
});

it("re-seeds the fields when the stored reminder changes", async () => {
  const onSave = jest.fn();
  await render(<PlaceReminderBlock reminderAt={null} onSave={onSave} />);
  expect(lastDateInput().value).toBeNull();

  await screen.rerender(<PlaceReminderBlock reminderAt={FUTURE} onSave={onSave} />);
  expect(lastDateInput().value).toBe("2099-05-01");
  expect(lastTimeChip().value).toBe("10:00:00");
});

it("marks a reminder that already fired as passed", async () => {
  await render(<PlaceReminderBlock reminderAt={PAST} onSave={jest.fn()} />);
  expect(
    screen.getByText(`reminder_passed:${formatDateTime(PAST)}`),
  ).toBeOnTheScreen();
});

it("refuses a moment in the past", async () => {
  await render(<PlaceReminderBlock reminderAt={null} onSave={jest.fn()} />);
  await pick("2000-01-01", "08:00:00");

  expect(lastDateInput().error).toBe("reminder_in_past");
  expect(screen.queryByText("set_reminder")).toBeNull();
});

it("deletes the stored reminder", async () => {
  const onSave = jest.fn();
  await render(<PlaceReminderBlock reminderAt={FUTURE} onSave={onSave} />);

  await fireEvent.press(screen.getByText("delete_reminder"));
  expect(onSave).toHaveBeenCalledWith(null);
});

// Disabled while a save is in flight (or offline): no second request.
it("does nothing while disabled", async () => {
  const onSave = jest.fn();
  await render(<PlaceReminderBlock reminderAt={FUTURE} onSave={onSave} disabled />);
  expect(lastDateInput().disabled).toBe(true);
  expect(lastTimeChip().disabled).toBe(true);

  await pick("2099-06-02", "08:30:00");
  expect(screen.queryByText("set_reminder")).toBeNull();

  await fireEvent.press(screen.getByText("delete_reminder"));
  expect(onSave).not.toHaveBeenCalled();
});
