jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
// Bone/SkeletonGroup (and their shimmer) are tested in ui/Skeleton; here only
// the shape each placeholder is drawn in.
jest.mock("../../ui/Skeleton", () => {
  const { View } = require("react-native");
  return {
    Bone: (props: Record<string, unknown>) => {
      mockBoneProps(props);
      return <View testID="bone" />;
    },
    SkeletonGroup: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

import { render, screen } from "@testing-library/react-native";
import { SparklineSkeleton } from "../SparklineSkeleton";
import StatsSkeleton from "../StatsSkeleton";

const mockBoneProps = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

it("SparklineSkeleton draws a header and a wave of bars that fades in towards today", async () => {
  await render(<SparklineSkeleton />);

  // Two header bones, then the bars.
  expect(screen.getAllByTestId("bone")).toHaveLength(2 + 20);
  const bars = mockBoneProps.mock.calls.slice(2).map((c) => c[0]);

  // Not a row of equal bars — it has to read as a chart.
  expect(new Set(bars.map((b) => b.height)).size).toBeGreaterThan(1);
  const opacities = bars.map((b) => b.baseOpacity as number);
  expect(opacities).toEqual([...opacities].sort((a, b) => a - b));
  expect(opacities[0]).toBe(0.5);
});

it("StatsSkeleton draws four cards of a number and a label", async () => {
  await render(<StatsSkeleton />);

  expect(screen.getAllByTestId("bone")).toHaveLength(4 * 2);
  expect(mockBoneProps.mock.calls.map((c) => c[0].height)).toEqual([26, 13, 26, 13, 26, 13, 26, 13]);
});
