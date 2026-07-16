jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("@expo/vector-icons", () => {
  const { View } = require("react-native");
  return { Ionicons: View };
});

const mockSliderCapture = jest.fn();
jest.mock("@react-native-community/slider", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockSliderCapture(props);
    return null;
  },
}));

import { fireEvent, render, screen } from "@testing-library/react-native";
import RadiusRow from "../RadiusRow";

const mockOnChange = jest.fn();
const mockOnSave = jest.fn().mockResolvedValue(true);

const sliderProps = () => mockSliderCapture.mock.calls.at(-1)![0] as {
  minimumValue: number;
  maximumValue: number;
  value: number;
  onValueChange: (v: number) => void;
  onSlidingComplete: (v: number) => Promise<boolean>;
};

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows the current value with the km unit", async () => {
  await render(<RadiusRow value={42} onChange={mockOnChange} onSave={mockOnSave} />);
  expect(screen.getByText("42 km", { exact: false })).toBeOnTheScreen();
});

it("shows the hint when provided, and nothing when it's not", async () => {
  const { rerender } = await render(
    <RadiusRow value={42} onChange={mockOnChange} onSave={mockOnSave} hint="Pick a radius" />,
  );
  expect(screen.getByText("Pick a radius")).toBeOnTheScreen();

  await rerender(<RadiusRow value={42} onChange={mockOnChange} onSave={mockOnSave} />);
  expect(screen.queryByText("Pick a radius")).not.toBeOnTheScreen();
});

describe("slider wiring", () => {
  it("passes value/min/onChange/onSave through, defaulting max to 500", async () => {
    await render(<RadiusRow value={42} onChange={mockOnChange} onSave={mockOnSave} />);
    const props = sliderProps();
    expect(props.value).toBe(42);
    expect(props.minimumValue).toBe(1);
    expect(props.maximumValue).toBe(500);

    props.onValueChange(77);
    expect(mockOnChange).toHaveBeenCalledWith(77);

    await props.onSlidingComplete(77);
    expect(mockOnSave).toHaveBeenCalledWith(77);
  });

  it("honors a custom maxValue", async () => {
    await render(<RadiusRow value={42} onChange={mockOnChange} onSave={mockOnSave} maxValue={100} />);
    expect(sliderProps().maximumValue).toBe(100);
  });
});

describe("preset chips", () => {
  it("renders the 4 distance presets and calls onChange+onSave when one is tapped", async () => {
    await render(<RadiusRow value={42} onChange={mockOnChange} onSave={mockOnSave} />);

    for (const label of ["5 km", "50 km", "250 km", "500 km"]) {
      expect(screen.getByText(label)).toBeOnTheScreen();
    }

    await fireEvent.press(screen.getByText("50 km"));
    expect(mockOnChange).toHaveBeenCalledWith(50);
    expect(mockOnSave).toHaveBeenCalledWith(50);
  });
});
