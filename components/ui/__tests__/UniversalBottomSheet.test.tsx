jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
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

const mockInnerPresent = jest.fn();
const mockInnerDismiss = jest.fn();
let capturedOnDismiss: (() => void) | undefined;

jest.mock("@gorhom/bottom-sheet", () => {
  const React = require("react");
  const { View, TextInput } = require("react-native");
  return {
    __esModule: true,
    BottomSheetModal: React.forwardRef((props: { children?: React.ReactNode; onDismiss?: () => void }, ref: React.Ref<unknown>) => {
      capturedOnDismiss = props.onDismiss;
      React.useImperativeHandle(ref, () => ({
        present: mockInnerPresent,
        dismiss: mockInnerDismiss,
      }));
      return <View>{props.children}</View>;
    }),
    BottomSheetView: ({ children, style }: { children?: React.ReactNode; style?: unknown }) => (
      <View style={style}>{children}</View>
    ),
    BottomSheetTextInput: (props: Record<string, unknown>) => <TextInput {...props} />,
    BottomSheetBackdrop: () => null,
  };
});

import { createRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import UniversalBottomSheet, { BottomSheetRef } from "../UniversalBottomSheet";
import { navigationRef } from "../../../services/navigationRef";

// A minimal NavigationContainerRef double: the sheet subscribes to "state" and
// checks whether the screen that opened it is still in the navigation tree. The
// stack lives in a nested navigator (like drawer → native-stack in the app) so
// that walking the tree is exercised, not only the root level.
type MockRoute = { key: string; name: string; state?: { routes: MockRoute[] } };
const stateListeners: (() => void)[] = [];
let routeStack: MockRoute[] = [];
const mockUnsubscribe = jest.fn();

const mountNavigation = () => {
  (navigationRef as { current: unknown }).current = {
    isReady: () => true,
    getCurrentRoute: () => routeStack[routeStack.length - 1],
    getRootState: () => ({
      routes: [{ key: "Drawer-0", name: "Drawer", state: { routes: routeStack } }],
    }),
    addListener: (event: string, cb: () => void) => {
      if (event === "state") stateListeners.push(cb);
      // Unsubscribing from a real NavigationContainerRef removes the listener —
      // the double has to behave the same way, otherwise the test would not
      // notice a leaked subscription.
      return () => {
        mockUnsubscribe();
        const i = stateListeners.indexOf(cb);
        if (i !== -1) stateListeners.splice(i, 1);
      };
    },
  };
};

const emitState = async () => {
  await act(async () => {
    stateListeners.forEach((cb) => cb());
  });
};

const push = async (key: string) => {
  routeStack.push({ key, name: key });
  await emitState();
};

const pop = async () => {
  routeStack.pop();
  await emitState();
};

const mockOnConfirm = jest.fn();
const mockOnError = jest.fn();
const mockOnPress1 = jest.fn();
const mockOnPress2 = jest.fn();
const mockOnReset = jest.fn();
const mockRenderContent = jest.fn((dismiss: () => void) => {
  const { Text, TouchableOpacity } = require("react-native");
  return (
    <TouchableOpacity testID="content-dismiss" onPress={dismiss}>
      <Text>content body</Text>
    </TouchableOpacity>
  );
});

const renderSheet = async () => {
  const ref = createRef<BottomSheetRef>();
  await render(<UniversalBottomSheet ref={ref} />);
  return ref;
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockOnConfirm.mockResolvedValue(undefined);
  stateListeners.length = 0;
  routeStack = [
    { key: "Main-0", name: "Main" },
    { key: "Places-1", name: "Places" },
  ];
  (navigationRef as { current: unknown }).current = null;
});

afterEach(() => {
  jest.useRealTimers();
  (navigationRef as { current: unknown }).current = null;
});

describe("imperative handle", () => {
  it("present() forwards to the inner sheet's present()", async () => {
    const ref = await renderSheet();
    await act(async () => {
      ref.current?.present({ mode: "menu", items: [{ label: "A", onPress: mockOnPress1 }] });
    });
    expect(mockInnerPresent).toHaveBeenCalledTimes(1);
  });

  it("dismiss() forwards to the inner sheet's dismiss()", async () => {
    const ref = await renderSheet();
    await act(async () => {
      ref.current?.dismiss();
    });
    expect(mockInnerDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("menu mode", () => {
  it("renders the title and every item, calling onPress for the tapped one", async () => {
    const ref = await renderSheet();
    await act(async () => {
      ref.current?.present({
        mode: "menu",
        title: "Choose",
        items: [
          { label: "Edit", onPress: mockOnPress1 },
          { label: "Delete", onPress: mockOnPress2, danger: true, icon: "trash" },
        ],
      });
    });

    expect(screen.getByText("Choose")).toBeOnTheScreen();
    expect(screen.getByText("Edit")).toBeOnTheScreen();
    expect(screen.getByText("trash")).toBeOnTheScreen();

    await fireEvent.press(screen.getByText("Delete"));
    expect(mockOnPress2).toHaveBeenCalledTimes(1);
    expect(mockOnPress1).not.toHaveBeenCalled();
  });
});

describe("confirm mode — no required input", () => {
  const present = async (ref: React.RefObject<BottomSheetRef | null>) =>
    act(async () => {
      ref.current?.present({
        mode: "confirm",
        title: "Remove item",
        description: "Are you sure?",
        confirmText: "Remove",
        cancelText: "Cancel",
        onConfirm: mockOnConfirm,
        onError: mockOnError,
      });
    });

  it("renders title/description/buttons, and cancel calls dismiss", async () => {
    const ref = await renderSheet();
    await present(ref);

    expect(screen.getByText("Remove item")).toBeOnTheScreen();
    expect(screen.getByText("Are you sure?")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("bottom-sheet-cancel-button"));
    expect(mockInnerDismiss).toHaveBeenCalledTimes(1);
  });

  it("confirm is enabled by default (no requiredInput), and calls onConfirm then dismisses", async () => {
    const ref = await renderSheet();
    await present(ref);

    expect(screen.getByTestId("bottom-sheet-confirm-button").props.accessibilityState?.disabled).toBeFalsy();

    await act(async () => {
      await fireEvent.press(screen.getByTestId("bottom-sheet-confirm-button"));
    });
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    expect(mockInnerDismiss).toHaveBeenCalledTimes(1);
  });

  it("dismisses immediately on a rejected onConfirm, then calls onError after a delay", async () => {
    mockOnConfirm.mockRejectedValue(new Error("boom"));
    const ref = await renderSheet();
    await present(ref);

    await act(async () => {
      await fireEvent.press(screen.getByTestId("bottom-sheet-confirm-button"));
    });
    expect(mockInnerDismiss).toHaveBeenCalledTimes(1);
    expect(mockOnError).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    expect(mockOnError).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe("confirm mode — required input", () => {
  const present = async (ref: React.RefObject<BottomSheetRef | null>, overrides: Record<string, unknown> = {}) =>
    act(async () => {
      ref.current?.present({
        mode: "confirm",
        title: "Delete account",
        confirmText: "Delete",
        cancelText: "Cancel",
        requiredInput: "DELETE",
        onConfirm: mockOnConfirm,
        ...overrides,
      });
    });

  it("disables confirm until the exact (trimmed, case-insensitive) text is entered", async () => {
    const ref = await renderSheet();
    await present(ref);

    expect(screen.getByTestId("bottom-sheet-confirm-button").props.accessibilityState?.disabled).toBe(true);

    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText("DELETE"), " delete ");
    });
    expect(screen.getByTestId("bottom-sheet-confirm-button").props.accessibilityState?.disabled).toBeFalsy();
  });

  it("falls back the placeholder to the required text when inputPlaceholder isn't given", async () => {
    const ref = await renderSheet();
    await present(ref);
    expect(screen.getByPlaceholderText("DELETE")).toBeOnTheScreen();
  });

  it("supports requiredInput/description/inputPlaceholder as functions of confirm.data", async () => {
    const ref = await renderSheet();
    await present(ref, {
      data: { name: "Robin" },
      requiredInput: (data: { name: string }) => data.name,
      description: (data: { name: string }) => `Type ${data.name} to confirm`,
      inputPlaceholder: (data: { name: string }) => `e.g. ${data.name}`,
    });

    expect(screen.getByText("Type Robin to confirm")).toBeOnTheScreen();
    expect(screen.getByPlaceholderText("e.g. Robin")).toBeOnTheScreen();

    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText("e.g. Robin"), "robin");
    });
    expect(screen.getByTestId("bottom-sheet-confirm-button").props.accessibilityState?.disabled).toBeFalsy();
  });
});

describe("content mode", () => {
  it("renders the title bar with a reset button that resets then dismisses", async () => {
    const ref = await renderSheet();
    await act(async () => {
      ref.current?.present({
        mode: "content",
        title: "Filters",
        onReset: mockOnReset,
        renderContent: mockRenderContent,
      });
    });

    expect(screen.getByText("Filters")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("reset"));
    expect(mockOnReset).toHaveBeenCalledTimes(1);
    expect(mockInnerDismiss).toHaveBeenCalledTimes(1);
  });

  it("omits the reset button without onReset, and the title bar entirely without a title", async () => {
    const ref = await renderSheet();
    await act(async () => {
      ref.current?.present({ mode: "content", renderContent: mockRenderContent });
    });

    expect(screen.queryByText("reset")).not.toBeOnTheScreen();
    expect(screen.getByText("content body")).toBeOnTheScreen();
  });

  it("passes its own dismiss down to renderContent", async () => {
    const ref = await renderSheet();
    await act(async () => {
      ref.current?.present({ mode: "content", renderContent: mockRenderContent });
    });

    await fireEvent.press(screen.getByTestId("content-dismiss"));
    expect(mockInnerDismiss).toHaveBeenCalledTimes(1);
  });
});

// The sheet is a single one for the whole app and lives outside the navigator,
// so leaving a screen did not close it by itself: it stayed on top of the next
// screen and swallowed taps (a real case — "Location unavailable" from
// PlaceEditorScreen, stuck above the main screen).
describe("dismissal on route change", () => {
  const presentMenu = async (ref: React.RefObject<BottomSheetRef | null>) =>
    act(async () => {
      ref.current?.present({
        mode: "menu",
        items: [{ label: "Only item", onPress: mockOnPress1 }],
      });
    });

  it("closes once the route the sheet was opened on leaves the stack", async () => {
    mountNavigation();
    const ref = await renderSheet();
    await presentMenu(ref);

    await pop();

    expect(mockInnerDismiss).toHaveBeenCalledTimes(1);
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it("stays open when navigation pushes a screen on top of the owner", async () => {
    mountNavigation();
    const ref = await renderSheet();
    await presentMenu(ref);

    await push("PlaceEditor-2");

    expect(mockInnerDismiss).not.toHaveBeenCalled();
  });

  it("stays open when the same route merely updates its params", async () => {
    mountNavigation();
    const ref = await renderSheet();
    await presentMenu(ref);

    await emitState();

    expect(mockInnerDismiss).not.toHaveBeenCalled();
  });

  // A capture miss: present() landed while navigation was still in transit, and
  // the screen below the current one was recorded as the owner. While it is in
  // the stack it must not be dismissed, otherwise the very first state event
  // would kill the sheet that just opened.
  it("stays open when the captured owner is a lower screen of the stack", async () => {
    mountNavigation();
    routeStack = [{ key: "Main-0", name: "Main" }];
    const ref = await renderSheet();
    await presentMenu(ref);

    await push("Places-1");
    await push("PlaceEditor-2");

    expect(mockInnerDismiss).not.toHaveBeenCalled();

    // But once the owner does disappear — the sheet is dismissed.
    routeStack = [{ key: "Other-9", name: "Other" }];
    await emitState();
    expect(mockInnerDismiss).toHaveBeenCalledTimes(1);
  });

  it("still presents when navigation isn't mounted yet", async () => {
    const ref = await renderSheet();
    await act(async () => {
      ref.current?.present({
        mode: "menu",
        items: [{ label: "Only item", onPress: mockOnPress1 }],
      });
    });

    expect(mockInnerPresent).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Only item")).toBeOnTheScreen();
  });

  it("drops the route watch once the sheet is dismissed for real", async () => {
    mountNavigation();
    const ref = await renderSheet();
    await presentMenu(ref);

    await act(async () => {
      capturedOnDismiss?.();
    });
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);

    await pop();
    expect(mockInnerDismiss).not.toHaveBeenCalled();
  });

  // A second dismiss() on an already closed sheet breaks BottomSheetModal —
  // after it present() silently shows nothing (caught in e2e: confirming a
  // deletion closed the sheet, leaving the screen sent a finishing dismiss, and
  // on the next screen the confirmation sheet no longer came up).
  it("never dismisses a sheet that is already closed when its screen leaves", async () => {
    mountNavigation();
    const ref = await renderSheet();
    await presentMenu(ref);

    // Closing by confirmation: our dismiss() plus the onDismiss in response.
    await act(async () => {
      ref.current?.dismiss();
      capturedOnDismiss?.();
    });
    expect(mockInnerDismiss).toHaveBeenCalledTimes(1);

    await pop();
    expect(mockInnerDismiss).toHaveBeenCalledTimes(1);
  });

  // onDismiss arrives at the end of the closing animation, the navigation event
  // right away: without dropping the subscription inside dismiss() itself the
  // watcher manages to finish off a sheet that is still closing (caught in an
  // e2e log: 126 ms between our dismiss and the watcher's, with onDismiss not
  // yet arrived).
  it("stops watching as soon as we dismiss, before onDismiss arrives", async () => {
    mountNavigation();
    const ref = await renderSheet();
    await presentMenu(ref);

    await act(async () => {
      ref.current?.dismiss();
    });
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);

    await pop();
    expect(mockInnerDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("handleDismiss guard against a spurious replace-echo", () => {
  // The echo only happens on a present() over an open sheet: stackBehavior
  // "replace" dismisses the replaced one and fires its onDismiss after the new
  // one is already shown. The guard is tied to exactly that condition —
  // otherwise the first (genuine) close would be taken for an echo, see the test
  // about the finishing dismiss above.
  it("ignores the onDismiss echo of a replaced sheet, but honors a genuine one", async () => {
    const ref = await renderSheet();
    await act(async () => {
      ref.current?.present({
        mode: "menu",
        items: [{ label: "First item", onPress: mockOnPress1 }],
      });
    });

    await act(async () => {
      ref.current?.present({
        mode: "menu",
        items: [{ label: "Second item", onPress: mockOnPress2 }],
      });
    });
    expect(screen.getByText("Second item")).toBeOnTheScreen();

    // The echo of the replaced sheet — the content of the new one must survive.
    await act(async () => {
      capturedOnDismiss?.();
    });
    expect(screen.getByText("Second item")).toBeOnTheScreen();

    // A genuine close (swipe) — the content must be cleared.
    await act(async () => {
      capturedOnDismiss?.();
    });
    expect(screen.queryByText("Second item")).not.toBeOnTheScreen();
  });

  it("clears content on the first onDismiss when nothing was replaced", async () => {
    const ref = await renderSheet();
    await act(async () => {
      ref.current?.present({
        mode: "menu",
        items: [{ label: "Only item", onPress: mockOnPress1 }],
      });
    });
    expect(screen.getByText("Only item")).toBeOnTheScreen();

    await act(async () => {
      capturedOnDismiss?.();
    });
    expect(screen.queryByText("Only item")).not.toBeOnTheScreen();
  });
});
