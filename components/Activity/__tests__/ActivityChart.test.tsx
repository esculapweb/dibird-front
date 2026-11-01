jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
// Native SVG elements render as opaque host nodes whose text and props no
// query can reach, so each shape is stubbed as a View carrying its props.
jest.mock("react-native-svg", () => {
  const { Pressable, Text, View } = require("react-native");
  const shape =
    (kind: string) =>
    ({ testID, ...props }: { testID?: string }) => <View testID={testID ?? `svg-${kind}`} {...props} />;
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    G: ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) => (
      <Pressable testID="svg-g" onPress={onPress}>
        {children}
      </Pressable>
    ),
    Line: shape("line"),
    Rect: shape("rect"),
    Circle: shape("circle"),
    Text: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
  };
});

import { fireEvent, render, screen } from "@testing-library/react-native";
import ActivityChart from "../ActivityChart";

const PERIODS = ["2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04"];

const renderChart = (
  props: Partial<React.ComponentProps<typeof ActivityChart>> = {},
) => {
  const onSelect = jest.fn();
  return {
    onSelect,
    result: render(
      <ActivityChart
        data={[3, 0, 5, 1]}
        periods={PERIODS}
        group="year"
        width={300}
        selected={null}
        onSelect={onSelect}
        {...props}
      />,
    ),
  };
};

// One <G> per gridline, then one per column.
const columns = () => screen.getAllByTestId("svg-g").slice(-PERIODS.length);

// Bars are the opaque rects; each column also has a transparent hit area.
const bars = () =>
  screen.getAllByTestId("svg-rect").filter((r) => r.props.fill !== "transparent");

it("draws a bar for every non-empty column and labels the axes", async () => {
  const { result } = renderChart();
  await result;

  expect(screen.getByTestId("activity-chart")).toBeOnTheScreen();
  expect(bars()).toHaveLength(3);
  // Y ticks: 0, the middle line and the rounded-up maximum.
  expect(screen.getByText("0")).toBeOnTheScreen();
  expect(screen.getByText("6")).toBeOnTheScreen();
  expect(screen.getByText("3")).toBeOnTheScreen();
  // X labels are the period starts, formatted for the group.
  expect(screen.getAllByText("2026")).toHaveLength(PERIODS.length);
});

it("gives a one-observation bar a visible minimum height", async () => {
  const { result } = renderChart({ data: [1000, 0, 0, 1] });
  await result;

  const heights = bars().map((r) => r.props.height);
  expect(Math.min(...heights)).toBeGreaterThanOrEqual(2);
});

it("draws only the 0 and 1 gridlines when every column is at most one", async () => {
  const { result } = renderChart({ data: [0, 1, 0, 0] });
  await result;

  expect(screen.getByText("0")).toBeOnTheScreen();
  expect(screen.getByText("1")).toBeOnTheScreen();
  expect(screen.getAllByTestId("svg-g")).toHaveLength(2 + PERIODS.length);
});

it("selects the tapped column, empty ones included", async () => {
  const { onSelect, result } = renderChart();
  await result;

  await fireEvent.press(columns()[1]);
  expect(onSelect).toHaveBeenCalledWith(1);
});

it("marks the selected column and dims the others", async () => {
  const { result } = renderChart({ selected: 2 });
  await result;

  expect(screen.getByTestId("activity-chart-marker")).toBeOnTheScreen();
  expect(bars().map((r) => r.props.opacity)).toEqual([0.45, 1, 0.45]);
});

it("shows no marker and full bars with nothing selected", async () => {
  const { result } = renderChart();
  await result;

  expect(screen.queryByTestId("activity-chart-marker")).toBeNull();
  expect(bars().every((r) => r.props.opacity === 1)).toBe(true);
});

it("skips the label of a column without a period", async () => {
  const { result } = renderChart({ periods: PERIODS.slice(0, 2) });
  await result;

  expect(screen.getAllByText("2026")).toHaveLength(2);
});
