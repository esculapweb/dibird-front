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
});

afterEach(() => {
  jest.useRealTimers();
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

describe("handleDismiss guard against a spurious replace-echo", () => {
  it("ignores the first onDismiss right after present(), but honors a later one", async () => {
    const ref = await renderSheet();
    await act(async () => {
      ref.current?.present({
        mode: "menu",
        items: [{ label: "Only item", onPress: mockOnPress1 }],
      });
    });
    expect(screen.getByText("Only item")).toBeOnTheScreen();

    // Simulated echo from the library right after present() (stackBehavior
    // "replace" firing onDismiss for the sheet being replaced) — content
    // must survive.
    await act(async () => {
      capturedOnDismiss?.();
    });
    expect(screen.getByText("Only item")).toBeOnTheScreen();

    // A genuine later dismiss (swipe-to-close) — content must clear.
    await act(async () => {
      capturedOnDismiss?.();
    });
    expect(screen.queryByText("Only item")).not.toBeOnTheScreen();
  });
});
