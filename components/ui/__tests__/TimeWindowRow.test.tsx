jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name, testID }: { name: string; testID?: string }) => (
      <Text testID={testID ?? `icon-${name}`}>{name}</Text>
    ),
  };
});

const mockHourPickerCapture = jest.fn();
jest.mock("../HourPicker", () => ({
  __esModule: true,
  HourPicker: (props: Record<string, unknown>) => {
    mockHourPickerCapture(props);
    return null;
  },
}));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { mockColors } from "../../../screens/mockTheme";
import { TimeWindowRow } from "../TimeWindowRow";

const mockOnChangeStart = jest.fn();
const mockOnChangeEnd = jest.fn();
const mockOnRemove = jest.fn();

const baseProps = () => ({
  window: [9, 17] as [number, number],
  index: 0,
  onChangeStart: mockOnChangeStart,
  onChangeEnd: mockOnChangeEnd,
  onRemove: mockOnRemove,
  colors: mockColors as never,
});

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows the 1-based index and zero-padded start/end hours in the collapsed header", async () => {
  await render(<TimeWindowRow {...baseProps()} index={2} window={[6, 20]}></TimeWindowRow>);
  expect(screen.getByText("3. 06:00 - 20:00")).toBeOnTheScreen();
});

it("calls onRemove when the remove icon is pressed, without expanding", async () => {
  await render(<TimeWindowRow {...baseProps()} />);
  await fireEvent.press(screen.getByText("close-circle-outline"));
  expect(mockOnRemove).toHaveBeenCalledTimes(1);
  expect(mockHourPickerCapture).not.toHaveBeenCalled();
});

describe("expand/collapse", () => {
  it("is collapsed by default: no pickers, chevron-down shown", async () => {
    await render(<TimeWindowRow {...baseProps()} />);
    expect(screen.getByText("chevron-down")).toBeOnTheScreen();
    expect(mockHourPickerCapture).not.toHaveBeenCalled();
  });

  it("expands on header press, showing from/to pickers and chevron-up", async () => {
    await render(<TimeWindowRow {...baseProps()} />);
    await fireEvent.press(screen.getByText("1. 09:00 - 17:00"));

    expect(screen.getByText("chevron-up")).toBeOnTheScreen();
    expect(screen.getByText("from")).toBeOnTheScreen();
    expect(screen.getByText("to")).toBeOnTheScreen();
    expect(mockHourPickerCapture).toHaveBeenCalledTimes(2);
  });

  it("wires the from/to HourPickers to onChangeStart/onChangeEnd with the current values", async () => {
    await render(<TimeWindowRow {...baseProps()} window={[9, 17]} />);
    await fireEvent.press(screen.getByText("1. 09:00 - 17:00"));

    const calls = mockHourPickerCapture.mock.calls.map((c) => c[0]);
    expect(calls[0]).toMatchObject({ value: 9, onChange: mockOnChangeStart });
    expect(calls[1]).toMatchObject({ value: 17, onChange: mockOnChangeEnd });
  });

  it("collapses again on a second header press", async () => {
    await render(<TimeWindowRow {...baseProps()} />);
    const header = screen.getByText("1. 09:00 - 17:00");
    await fireEvent.press(header);
    expect(screen.getByText("chevron-up")).toBeOnTheScreen();

    await fireEvent.press(header);
    expect(screen.getByText("chevron-down")).toBeOnTheScreen();
    expect(screen.queryByText("from")).not.toBeOnTheScreen();
  });
});
