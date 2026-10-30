jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name, testID }: { name: string; testID?: string }) => (
      <Text testID={testID ?? `icon-${name}`}>{name}</Text>
    ),
  };
});
// The real component's gesture logs a worklet warning under jest (the worklets
// babel plugin doesn't reach node_modules here). What this suite checks is
// SwipeableRow's own wiring, so a pass-through rendering both sides is enough;
// its swipe callbacks are captured to drive the row by hand.
jest.mock("react-native-gesture-handler/ReanimatedSwipeable", () => {
  const { forwardRef, useImperativeHandle } = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: forwardRef(
      (
        props: {
          children: React.ReactNode;
          renderLeftActions?: () => React.ReactNode;
          renderRightActions?: () => React.ReactNode;
        },
        ref: React.Ref<unknown>,
      ) => {
        mockSwipeableProps.current = props as never;
        useImperativeHandle(ref, () => ({ close: mockClose }));
        return (
          <View testID="swipeable">
            <View testID="left-panel">{props.renderLeftActions?.()}</View>
            {props.children}
            <View testID="right-panel">{props.renderRightActions?.()}</View>
          </View>
        );
      },
    ),
  };
});

import { Text } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import SwipeableRow, { SwipeAction, swipeA11yProps } from "../SwipeableRow";

const mockClose = jest.fn();
const mockSwipeableProps: {
  current: {
    onSwipeableOpenStartDrag: () => void;
    onSwipeableClose: () => void;
  } | null;
} = { current: null };

const onShare = jest.fn();
const onDelete = jest.fn();
const SHARE: SwipeAction = {
  icon: "share-social-outline",
  label: "share",
  color: "#0a0",
  onPress: onShare,
  testID: "row-share",
};
const DELETE: SwipeAction = {
  icon: "trash-outline",
  label: "delete",
  color: "#f00",
  onPress: onDelete,
  testID: "row-delete",
};

const renderRow = (left: SwipeAction[] = [SHARE], right: SwipeAction[] = [DELETE]) =>
  render(
    <SwipeableRow leftActions={left} rightActions={right}>
      <Text>row</Text>
    </SwipeableRow>,
  );

const startSwipe = () =>
  act(() => {
    mockSwipeableProps.current!.onSwipeableOpenStartDrag();
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockSwipeableProps.current = null;
});

it("renders just the children when there are no actions", async () => {
  await render(
    <SwipeableRow>
      <Text>row</Text>
    </SwipeableRow>,
  );
  expect(screen.getByText("row")).toBeOnTheScreen();
  expect(screen.queryByTestId("swipeable")).toBeNull();
});

// A closed row used to carry its (transparent) buttons in the accessibility
// tree and the view hierarchy — focusable by a screen reader, matchable by a
// Maestro text selector.
it("keeps a closed row free of buttons, its panels hidden from screen readers", async () => {
  await renderRow();

  expect(screen.getByText("row")).toBeOnTheScreen();
  expect(screen.queryByTestId("row-share")).toBeNull();
  expect(screen.queryByTestId("row-delete")).toBeNull();
  expect(screen.queryByText("delete")).toBeNull();

  const panel = screen.getByTestId("right-panel").children[0] as never as {
    props: Record<string, unknown>;
  };
  expect(panel.props.accessibilityElementsHidden).toBe(true);
  expect(panel.props.importantForAccessibility).toBe("no-hide-descendants");
});

it("mounts the buttons as the swipe starts, and drops them once it closes", async () => {
  await renderRow();

  await startSwipe();
  expect(screen.getByTestId("row-share")).toBeOnTheScreen();
  expect(screen.getByTestId("row-delete")).toBeOnTheScreen();

  await act(() => {
    mockSwipeableProps.current!.onSwipeableClose();
  });
  expect(screen.queryByTestId("row-delete")).toBeNull();
});

it("closes the row and runs the pressed action", async () => {
  await renderRow();
  await startSwipe();

  await fireEvent.press(screen.getByTestId("row-delete"));
  expect(onDelete).toHaveBeenCalledTimes(1);
  expect(onShare).not.toHaveBeenCalled();
  // Closed so the row doesn't stay open behind the sheet the action opens.
  expect(mockClose).toHaveBeenCalledTimes(1);
});

// The card itself may render an icon of the same name (a favourite star next
// to the "favourite" action), so the action's icon gets an id of its own.
it("derives the icon's testID from the action's", async () => {
  await renderRow([], [{ ...DELETE, icon: "star", testID: "row-fav" }]);
  await startSwipe();

  expect(screen.getByTestId("row-fav-icon")).toBeOnTheScreen();
  expect(screen.queryByTestId("icon-star")).toBeNull();
});

describe("swipeA11yProps", () => {
  it("offers each action to screen readers by its label", () => {
    const { accessibilityActions } = swipeA11yProps([SHARE, DELETE]);
    expect(accessibilityActions).toEqual([
      { name: "swipe:row-share", label: "share" },
      { name: "swipe:row-delete", label: "delete" },
    ]);
  });

  it("runs the action the screen reader picked", () => {
    const { onAccessibilityAction } = swipeA11yProps([SHARE, DELETE]);
    onAccessibilityAction!({ nativeEvent: { actionName: "swipe:row-delete" } } as never);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onShare).not.toHaveBeenCalled();
  });

  it("ignores the platform's own actions", () => {
    const { onAccessibilityAction } = swipeA11yProps([SHARE]);
    onAccessibilityAction!({ nativeEvent: { actionName: "activate" } } as never);
    expect(onShare).not.toHaveBeenCalled();
  });

  it("adds nothing to a row without actions", () => {
    expect(swipeA11yProps([])).toEqual({});
  });
});
