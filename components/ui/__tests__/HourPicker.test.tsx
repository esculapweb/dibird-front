import { fireEvent, render, screen, act } from "@testing-library/react-native";
import { HourPicker } from "../HourPicker";
import { ThemeColors } from "../../../store/theme-context";

const COLORS = {
  main100: "#0a0",
  primary100: "#fff",
  primary200: "#eee",
  textSecondary: "#666",
} as ThemeColors;

const mockOnChange = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

it("renders all 24 hours, zero-padded", async () => {
  await render(<HourPicker value={0} onChange={mockOnChange} colors={COLORS} />);
  expect(screen.getByText("00")).toBeOnTheScreen();
  expect(screen.getByText("09")).toBeOnTheScreen();
  expect(screen.getByText("23")).toBeOnTheScreen();
  expect(screen.queryByText("24")).not.toBeOnTheScreen();
});

it("calls onChange with the pressed hour", async () => {
  await render(<HourPicker value={0} onChange={mockOnChange} colors={COLORS} />);
  await fireEvent.press(screen.getByText("17"));
  expect(mockOnChange).toHaveBeenCalledWith(17);
});

describe("active hour styling", () => {
  it("gives the active hour the active text color, and inactive hours the inactive color", async () => {
    await render(<HourPicker value={9} onChange={mockOnChange} colors={COLORS} />);

    const activeStyle = screen.getByText("09").props.style;
    expect(activeStyle).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: COLORS.primary100 })]),
    );

    const inactiveStyle = screen.getByText("10").props.style;
    expect(inactiveStyle).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: COLORS.textSecondary })]),
    );
  });
});

it("does not crash when the auto-scroll effect fires after mount", async () => {
  await render(<HourPicker value={9} onChange={mockOnChange} colors={COLORS} />);
  await act(async () => {
    jest.advanceTimersByTime(50);
  });
  expect(screen.getByText("09")).toBeOnTheScreen();
});
