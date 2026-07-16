jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));

import { fireEvent, render, screen } from "@testing-library/react-native";
import RadioGroup from "../RadioGroup";

const mockOnChange = jest.fn();
const mockOnDisabledPress = jest.fn();

const OPTIONS = [
  { label: "All", value: "all" },
  { label: "Today", value: "today" },
  { label: "This year", value: "this_year" },
];

beforeEach(() => {
  jest.clearAllMocks();
});

it("renders every option's label", async () => {
  await render(<RadioGroup value="all" options={OPTIONS} onChange={mockOnChange} />);
  expect(screen.getByText("All")).toBeOnTheScreen();
  expect(screen.getByText("Today")).toBeOnTheScreen();
  expect(screen.getByText("This year")).toBeOnTheScreen();
});

it("shows a label only when one is provided", async () => {
  const { rerender } = await render(
    <RadioGroup label="Period" value="all" options={OPTIONS} onChange={mockOnChange} />,
  );
  expect(screen.getByText("Period")).toBeOnTheScreen();

  await rerender(<RadioGroup value="all" options={OPTIONS} onChange={mockOnChange} />);
  expect(screen.queryByText("Period")).not.toBeOnTheScreen();
});

it("marks only the matching option as checked", async () => {
  await render(
    <RadioGroup value="today" options={OPTIONS} onChange={mockOnChange} testID="period" />,
  );
  expect(screen.queryByTestId("period-option-0-checked")).not.toBeOnTheScreen();
  expect(screen.getByTestId("period-option-1-checked")).toBeOnTheScreen();
  expect(screen.queryByTestId("period-option-2-checked")).not.toBeOnTheScreen();
});

it("calls onChange with the pressed option's value", async () => {
  await render(<RadioGroup value="all" options={OPTIONS} onChange={mockOnChange} />);
  await fireEvent.press(screen.getByText("Today"));
  expect(mockOnChange).toHaveBeenCalledWith("today");
});

it("does nothing when globally disabled", async () => {
  await render(
    <RadioGroup value="all" options={OPTIONS} onChange={mockOnChange} disabled testID="period" />,
  );
  await fireEvent.press(screen.getByTestId("period-option-1"));
  expect(mockOnChange).not.toHaveBeenCalled();
});

describe("per-option disabledValues", () => {
  it("routes a disabled option's press to onDisabledPress instead of onChange", async () => {
    await render(
      <RadioGroup
        value="all"
        options={OPTIONS}
        onChange={mockOnChange}
        disabledValues={["today"]}
        onDisabledPress={mockOnDisabledPress}
      />,
    );
    await fireEvent.press(screen.getByText("Today"));
    expect(mockOnChange).not.toHaveBeenCalled();
    expect(mockOnDisabledPress).toHaveBeenCalledWith("today");
  });

  it("still calls onChange normally for options not in disabledValues", async () => {
    await render(
      <RadioGroup
        value="all"
        options={OPTIONS}
        onChange={mockOnChange}
        disabledValues={["today"]}
      />,
    );
    await fireEvent.press(screen.getByText("This year"));
    expect(mockOnChange).toHaveBeenCalledWith("this_year");
  });
});
