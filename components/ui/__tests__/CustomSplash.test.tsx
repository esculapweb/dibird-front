jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));

import { act, render, screen } from "@testing-library/react-native";
import * as SplashScreen from "expo-splash-screen";
import { getFullVersion } from "../../../util/helpers";
import CustomSplash from "../CustomSplash";

const mockOnFinish = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  (SplashScreen.hideAsync as jest.Mock).mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

it("shows the app version", async () => {
  await render(<CustomSplash onFinish={mockOnFinish} />);
  expect(screen.getByText(`v${getFullVersion()}`)).toBeOnTheScreen();
});

it("does not finish before the 1s timer elapses", async () => {
  await render(<CustomSplash onFinish={mockOnFinish} />);
  await act(async () => {
    jest.advanceTimersByTime(999);
  });
  expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  expect(mockOnFinish).not.toHaveBeenCalled();
});

it("hides the splash and calls onFinish once the timer elapses (no waitFor given)", async () => {
  await render(<CustomSplash onFinish={mockOnFinish} />);
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  expect(mockOnFinish).toHaveBeenCalledTimes(1);
});

describe("waitFor", () => {
  it("waits for both the timer and the waitFor promise before finishing", async () => {
    let resolveWaitFor!: () => void;
    const waitFor = new Promise<void>((resolve) => {
      resolveWaitFor = resolve;
    });

    await render(<CustomSplash onFinish={mockOnFinish} waitFor={waitFor} />);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    // Timer elapsed, but waitFor hasn't resolved yet.
    expect(mockOnFinish).not.toHaveBeenCalled();

    await act(async () => {
      resolveWaitFor();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
    expect(mockOnFinish).toHaveBeenCalledTimes(1);
  });

  it("still waits for the timer even if waitFor resolves immediately", async () => {
    await render(<CustomSplash onFinish={mockOnFinish} waitFor={Promise.resolve()} />);
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(999);
    });
    expect(mockOnFinish).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(mockOnFinish).toHaveBeenCalledTimes(1);
  });
});

it("clears the timer on unmount, so onFinish never fires", async () => {
  const { unmount } = await render(<CustomSplash onFinish={mockOnFinish} />);
  await unmount();

  await act(async () => {
    jest.advanceTimersByTime(2000);
  });
  expect(mockOnFinish).not.toHaveBeenCalled();
  expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
});
