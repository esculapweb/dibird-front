jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock("expo-localization", () => ({ getLocales: jest.fn() }));

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import i18n from "../../services/i18n";
import { LanguageProvider, useLanguage } from "../language-context";

beforeEach(() => {
  jest.clearAllMocks();
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  (Localization.getLocales as jest.Mock).mockReturnValue([{ languageCode: "en" }]);
});

it("throws when used outside a LanguageProvider", async () => {
  await expect(renderHook(() => useLanguage())).rejects.toThrow(
    "useLanguage must be used within LanguageProvider",
  );
});

it("renders children immediately with the 'en' default, before init resolves", async () => {
  let resolveGet!: (v: string | null) => void;
  (AsyncStorage.getItem as jest.Mock).mockReturnValue(
    new Promise((resolve) => {
      resolveGet = resolve;
    }),
  );

  const { result } = await renderHook(() => useLanguage(), { wrapper: LanguageProvider });
  expect(result.current.language).toBe("en");
  expect(result.current.isReady).toBe(false);

  await act(async () => {
    resolveGet(null);
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(result.current.isReady).toBe(true);
});

describe("initial language resolution", () => {
  it("uses the stored language when present", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue("ru");
    const { result } = await renderHook(() => useLanguage(), { wrapper: LanguageProvider });

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.language).toBe("ru");
    expect(i18n.language).toBe("ru");
  });

  it("falls back to the device locale when nothing is stored", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (Localization.getLocales as jest.Mock).mockReturnValue([{ languageCode: "ru" }]);
    const { result } = await renderHook(() => useLanguage(), { wrapper: LanguageProvider });

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.language).toBe("ru");
  });

  it("falls back to 'en' when the device has no locales at all", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (Localization.getLocales as jest.Mock).mockReturnValue([]);
    const { result } = await renderHook(() => useLanguage(), { wrapper: LanguageProvider });

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.language).toBe("en");
  });
});

describe("changeLanguage", () => {
  it("updates i18n, local state, and persists the choice", async () => {
    const { result } = await renderHook(() => useLanguage(), { wrapper: LanguageProvider });
    await waitFor(() => expect(result.current.isReady).toBe(true));

    await act(async () => {
      await result.current.changeLanguage("ru");
    });
    expect(result.current.language).toBe("ru");
    expect(i18n.language).toBe("ru");
    expect(AsyncStorage.setItem).toHaveBeenCalledWith("language", "ru");
  });
});
