import { BottomSheet, bottomSheetRef } from "../bottomSheet";

const mockPresent = jest.fn();
const mockDismiss = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (bottomSheetRef as { current: unknown }).current = {
    present: mockPresent,
    dismiss: mockDismiss,
  };
});

afterEach(() => {
  (bottomSheetRef as { current: unknown }).current = null;
});

it("show() presents a confirm-mode payload", () => {
  BottomSheet.show({ title: "Delete?", confirmText: "Delete", cancelText: "Cancel" });
  expect(mockPresent).toHaveBeenCalledWith({
    mode: "confirm",
    title: "Delete?",
    confirmText: "Delete",
    cancelText: "Cancel",
  });
});

it("showContent() presents a content-mode payload", () => {
  const renderContent = jest.fn();
  BottomSheet.showContent({ title: "Filters", renderContent });
  expect(mockPresent).toHaveBeenCalledWith({
    mode: "content",
    title: "Filters",
    renderContent,
  });
});

it("showMenu() presents a menu-mode payload", () => {
  const items = [{ label: "Edit", onPress: jest.fn() }];
  BottomSheet.showMenu({ items });
  expect(mockPresent).toHaveBeenCalledWith({ mode: "menu", items });
});

it("hide() dismisses the sheet", () => {
  BottomSheet.hide();
  expect(mockDismiss).toHaveBeenCalledTimes(1);
});

it("does not throw when the sheet hasn't mounted yet (ref.current is null)", () => {
  (bottomSheetRef as { current: unknown }).current = null;
  expect(() => BottomSheet.show({ title: "x", confirmText: "y", cancelText: "z" })).not.toThrow();
  expect(() => BottomSheet.hide()).not.toThrow();
});
