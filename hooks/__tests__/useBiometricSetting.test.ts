jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

import { act, renderHook } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import { useBiometricSetting } from "../useBiometricSetting";

const getItemAsync = SecureStore.getItemAsync as jest.Mock;
const setItemAsync = SecureStore.setItemAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  setItemAsync.mockResolvedValue(undefined);
});

describe("initial load", () => {
  it("starts loading, then resolves enabled=true when the stored value is 'true'", async () => {
    getItemAsync.mockResolvedValue("true");
    const { result } = await renderHook(() => useBiometricSetting());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isEnabled).toBe(true);
    expect(getItemAsync).toHaveBeenCalledWith("biometric_enabled");
  });

  it("resolves enabled=false for any stored value other than the literal string 'true'", async () => {
    getItemAsync.mockResolvedValue("false");
    const { result } = await renderHook(() => useBiometricSetting());
    expect(result.current.isEnabled).toBe(false);
  });

  it("resolves enabled=false when nothing is stored yet", async () => {
    getItemAsync.mockResolvedValue(null);
    const { result } = await renderHook(() => useBiometricSetting());
    expect(result.current.isEnabled).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });
});

describe("toggle", () => {
  it("updates isEnabled immediately (optimistic) and persists the string value", async () => {
    getItemAsync.mockResolvedValue(null);
    const { result } = await renderHook(() => useBiometricSetting());
    expect(result.current.isEnabled).toBe(false);

    await act(async () => {
      await result.current.toggle(true);
    });

    expect(result.current.isEnabled).toBe(true);
    expect(setItemAsync).toHaveBeenCalledWith("biometric_enabled", "true");
  });

  it("persists 'false' when toggled off", async () => {
    getItemAsync.mockResolvedValue("true");
    const { result } = await renderHook(() => useBiometricSetting());

    await act(async () => {
      await result.current.toggle(false);
    });

    expect(result.current.isEnabled).toBe(false);
    expect(setItemAsync).toHaveBeenCalledWith("biometric_enabled", "false");
  });
});
