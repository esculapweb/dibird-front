// `useColorScheme` is a named-hook import inside theme-context.tsx — it
// resolves to a concrete function at module-load time, so a later
// `jest.spyOn` on the react-native namespace wouldn't affect it (see
// hooks/__tests__/useContentWidth.test.ts's comment for the full
// explanation). `Appearance` itself is used as a namespace-object property
// access (`Appearance.getColorScheme()`), so that one *can* be spied on
// directly, same as `Linking.openURL` elsewhere in this repo.
let mockSystemScheme: "light" | "dark" | null = "light";
jest.mock("react-native", () => {
  const actual = jest.requireActual("react-native");
  return new Proxy(actual, {
    get(target, prop, receiver) {
      if (prop === "useColorScheme") return () => mockSystemScheme;
      return Reflect.get(target, prop, receiver);
    },
  });
});
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ThemeProvider, useTheme } from "../theme-context";

beforeEach(() => {
  jest.clearAllMocks();
  mockSystemScheme = "light";
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  jest.spyOn(Appearance, "getColorScheme").mockReturnValue("light");
  jest.spyOn(Appearance, "setColorScheme").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("throws when used outside a ThemeProvider", async () => {
  await expect(renderHook(() => useTheme())).rejects.toThrow(
    "useTheme must be used within ThemeProvider",
  );
});

describe("initial hydration", () => {
  it("renders nothing until the stored theme has loaded", async () => {
    let resolveGet!: (v: string | null) => void;
    (AsyncStorage.getItem as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveGet = resolve;
      }),
    );

    const { result } = await renderHook(() => useTheme(), { wrapper: ThemeProvider });
    expect(result.current).toBeNull();

    await act(async () => {
      resolveGet(null);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current).not.toBeNull();
  });

  it("falls back to the system theme when nothing is stored", async () => {
    mockSystemScheme = "dark";
    const { result } = await renderHook(() => useTheme(), { wrapper: ThemeProvider });

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current!.theme).toBe("dark");
    expect(result.current!.isDark).toBe(true);
    expect(result.current!.manualTheme).toBeNull();
    expect(Appearance.setColorScheme).toHaveBeenCalledWith("unspecified");
  });

  it("adopts a validly-stored manual theme over the system theme", async () => {
    mockSystemScheme = "light";
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue("dark");
    const { result } = await renderHook(() => useTheme(), { wrapper: ThemeProvider });

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current!.theme).toBe("dark");
    expect(result.current!.manualTheme).toBe("dark");
    expect(Appearance.setColorScheme).toHaveBeenCalledWith("dark");
  });

  it("ignores a garbage stored value and falls back to system", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue("not-a-theme");
    const { result } = await renderHook(() => useTheme(), { wrapper: ThemeProvider });

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current!.manualTheme).toBeNull();
    expect(Appearance.setColorScheme).toHaveBeenCalledWith("unspecified");
  });

  it("still becomes ready if AsyncStorage.getItem rejects", async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error("boom"));
    const { result } = await renderHook(() => useTheme(), { wrapper: ThemeProvider });

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current!.manualTheme).toBeNull();
  });
});

describe("toggleTheme", () => {
  it("sets a manual theme, updates Appearance, and persists it", async () => {
    const { result } = await renderHook(() => useTheme(), { wrapper: ThemeProvider });
    await waitFor(() => expect(result.current).not.toBeNull());

    await act(async () => {
      result.current!.toggleTheme("dark");
    });
    expect(result.current!.theme).toBe("dark");
    expect(result.current!.manualTheme).toBe("dark");
    expect(Appearance.setColorScheme).toHaveBeenCalledWith("dark");
    expect(AsyncStorage.setItem).toHaveBeenCalledWith("theme", "dark");
  });

  it("clears the manual theme, reverting to system, and removes the stored value", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue("dark");
    const { result } = await renderHook(() => useTheme(), { wrapper: ThemeProvider });
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current!.manualTheme).toBe("dark");

    await act(async () => {
      result.current!.toggleTheme(null);
    });
    expect(result.current!.manualTheme).toBeNull();
    expect(Appearance.setColorScheme).toHaveBeenCalledWith("unspecified");
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith("theme");
  });

  it("does not throw when persisting the toggle fails", async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error("disk full"));
    const { result } = await renderHook(() => useTheme(), { wrapper: ThemeProvider });
    await waitFor(() => expect(result.current).not.toBeNull());

    await act(async () => {
      result.current!.toggleTheme("dark");
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current!.manualTheme).toBe("dark");
  });
});

it("exposes LightColors/DarkColors matching the resolved theme", async () => {
  mockSystemScheme = "dark";
  const { result } = await renderHook(() => useTheme(), { wrapper: ThemeProvider });
  await waitFor(() => expect(result.current).not.toBeNull());
  expect(result.current!.Colors).not.toBeUndefined();

  await act(async () => {
    result.current!.toggleTheme("light");
  });
  const lightColors = result.current!.Colors;

  await act(async () => {
    result.current!.toggleTheme("dark");
  });
  const darkColors = result.current!.Colors;

  expect(lightColors).not.toEqual(darkColors);
});
