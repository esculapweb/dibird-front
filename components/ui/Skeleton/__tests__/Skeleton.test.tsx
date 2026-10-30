// Module exports aren't spy-able, so the two hooks under test are wrapped
// here and steered per test.
const mockWithRepeat = jest.fn();
const mockUseReducedMotion = jest.fn(() => false);
jest.mock("react-native-reanimated", () => {
  const actual = jest.requireActual("react-native-reanimated");
  return {
    ...actual,
    __esModule: true,
    default: actual.default,
    withRepeat: (...args: unknown[]) => {
      mockWithRepeat(...args);
      return actual.withRepeat(...args);
    },
    useReducedMotion: () => mockUseReducedMotion(),
  };
});
jest.mock("../../../../store/theme-context", () => ({
  useTheme: () => require("../../../../screens/mockTheme").mockUseTheme(),
}));

import { render, screen } from "@testing-library/react-native";

import { Bone, ListSkeleton, SkeletonGroup } from "..";

beforeEach(() => {
  jest.clearAllMocks();
});

it("draws the requested number of rows", async () => {
  await render(<ListSkeleton count={3} />);
  expect(screen.getByTestId("list-skeleton")).toBeOnTheScreen();
  expect(screen.getAllByTestId("list-skeleton-row")).toHaveLength(3);
  expect(screen.queryByTestId("list-skeleton-tile")).not.toBeOnTheScreen();
});

it("draws tiles instead of rows for a grid", async () => {
  await render(<ListSkeleton numColumns={3} />);
  // Four rows of tiles by default.
  expect(screen.getAllByTestId("list-skeleton-tile")).toHaveLength(12);
  expect(screen.queryByTestId("list-skeleton-row")).not.toBeOnTheScreen();
});

it("takes a custom testID", async () => {
  await render(<ListSkeleton testID="custom-skeleton" />);
  expect(screen.getByTestId("custom-skeleton")).toBeOnTheScreen();
});

it("renders a bone outside of a group", async () => {
  await render(<Bone width={40} height={10} />);
  expect(screen.toJSON()).not.toBeNull();
});

it("marks the group busy for screen readers", async () => {
  await render(
    <SkeletonGroup testID="group">
      <Bone />
    </SkeletonGroup>,
  );
  expect(screen.getByTestId("group")).toHaveProp("accessibilityState", {
    busy: true,
  });
});

it("pulses unless reduced motion is on", async () => {
  mockUseReducedMotion.mockReturnValue(true);
  const { unmount } = await render(
    <SkeletonGroup>
      <Bone />
    </SkeletonGroup>,
  );
  expect(mockWithRepeat).not.toHaveBeenCalled();
  await unmount();

  mockUseReducedMotion.mockReturnValue(false);
  await render(
    <SkeletonGroup>
      <Bone />
    </SkeletonGroup>,
  );
  expect(mockWithRepeat).toHaveBeenCalled();
});
