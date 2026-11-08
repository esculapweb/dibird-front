jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("../ThemedToast", () => ({ __esModule: true, default: {} }));

import { Keyboard, Platform, StyleSheet } from "react-native";
import { act, render, screen } from "@testing-library/react-native";

import KeyboardAwareToast from "../KeyboardAwareToast";

type Listener = (event?: { endCoordinates: { height: number } }) => void;

const listeners: Record<string, Listener> = {};
const remove = jest.fn();
const originalOS = Platform.OS;

const containerBottom = () =>
  StyleSheet.flatten(screen.getByTestId("toast-container").props.style).bottom;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Keyboard, "addListener").mockImplementation(((
    event: string,
    listener: Listener,
  ) => {
    listeners[event] = listener;
    return { remove };
  }) as unknown as typeof Keyboard.addListener);
});

afterEach(() => {
  Platform.OS = originalOS;
});

it("on Android, keeps the toast above the keyboard while it is open", async () => {
  Platform.OS = "android";
  await render(<KeyboardAwareToast />);
  expect(containerBottom()).toBe(0);

  await act(async () => {
    listeners.keyboardDidShow({ endCoordinates: { height: 320 } });
  });
  expect(containerBottom()).toBe(320);

  await act(async () => {
    listeners.keyboardDidHide();
  });
  expect(containerBottom()).toBe(0);
});

it("on Android, stops listening on unmount", async () => {
  Platform.OS = "android";
  const { unmount } = await render(<KeyboardAwareToast />);

  await unmount();

  expect(remove).toHaveBeenCalledTimes(2);
});

it("on iOS, leaves the keyboard to the library so the offset is not applied twice", async () => {
  Platform.OS = "ios";
  await render(<KeyboardAwareToast />);

  expect(Keyboard.addListener).not.toHaveBeenCalled();
  expect(containerBottom()).toBe(0);
});
