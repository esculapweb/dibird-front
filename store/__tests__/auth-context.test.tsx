jest.mock("expo-local-authentication", () => ({ authenticateAsync: jest.fn() }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn() }));
jest.mock("expo-notifications", () => ({ getExpoPushTokenAsync: jest.fn() }));
jest.mock("expo-constants", () => ({ expoConfig: { extra: { eas: { projectId: "proj-1" } } } }));
jest.mock("../../services/authService", () => ({ setOnTokenUpdate: jest.fn() }));
jest.mock("../../util/auth", () => ({ Logout: jest.fn() }));
jest.mock("../../services/api", () => ({ setOnUnauthorized: jest.fn() }));
jest.mock("../../services/i18n", () => ({ __esModule: true, default: { t: (key: string) => key } }));
jest.mock("../../services/bio", () => ({ shouldUseBiometrics: jest.fn() }));
jest.mock("../../util/fetches", () => ({ unregisterPushToken: jest.fn() }));
jest.mock("../../services/errors", () => ({ logError: jest.fn() }));

import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { setOnTokenUpdate } from "../../services/authService";
import { Logout } from "../../util/auth";
import { setOnUnauthorized } from "../../services/api";
import { shouldUseBiometrics } from "../../services/bio";
import { unregisterPushToken } from "../../util/fetches";
import { logError } from "../../services/errors";
import { AuthContextProvider, useAuth, setOnLogout } from "../auth-context";

const mockOnLogoutCallback = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (shouldUseBiometrics as jest.Mock).mockResolvedValue(false);
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
  (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({ data: "push-tok" });
  (Logout as jest.Mock).mockImplementation(async (cb: () => void) => cb());
  setOnLogout(mockOnLogoutCallback);
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  setOnLogout(null);
  jest.restoreAllMocks();
});

describe("token restoration on mount", () => {
  it("restores a stored token when biometrics aren't required", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("stored-token");
    const { result } = await renderHook(() => useAuth(), { wrapper: AuthContextProvider });

    await waitFor(() => expect(result.current.isInitializing).toBe(false));
    expect(result.current.token).toBe("stored-token");
    expect(result.current.isAuthenticated).toBe(true);
    expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
  });

  it("finishes initializing unauthenticated when there's no stored token", async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper: AuthContextProvider });
    await waitFor(() => expect(result.current.isInitializing).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("prompts biometrics first when required, then restores the token on success", async () => {
    (shouldUseBiometrics as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true });
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("stored-token");

    const { result } = await renderHook(() => useAuth(), { wrapper: AuthContextProvider });
    await waitFor(() => expect(result.current.isInitializing).toBe(false));
    expect(result.current.token).toBe("stored-token");
  });

  it("does not restore the token when the biometric prompt is declined/fails", async () => {
    (shouldUseBiometrics as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: false });
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("stored-token");

    const { result } = await renderHook(() => useAuth(), { wrapper: AuthContextProvider });
    await waitFor(() => expect(result.current.isInitializing).toBe(false));
    expect(result.current.token).toBeNull();
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
  });

  it("finishes initializing (unauthenticated, no crash) when SecureStore itself throws", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error("keychain unavailable"));
    const { result } = await renderHook(() => useAuth(), { wrapper: AuthContextProvider });
    await waitFor(() => expect(result.current.isInitializing).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
  });
});

describe("authenticate", () => {
  it("sets the token and persists it to SecureStore when given one", async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper: AuthContextProvider });
    await waitFor(() => expect(result.current.isInitializing).toBe(false));

    await act(async () => {
      await result.current.authenticate("new-token");
    });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("access", "new-token");
    await waitFor(() => expect(result.current.token).toBe("new-token"));
  });

  it("clears the token without touching SecureStore when given null", async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper: AuthContextProvider });
    await waitFor(() => expect(result.current.isInitializing).toBe(false));

    await act(async () => {
      await result.current.authenticate(null);
    });
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.token).toBeNull());
  });

  it("is registered with authService so a background token refresh updates context state", async () => {
    await renderHook(() => useAuth(), { wrapper: AuthContextProvider });
    expect(setOnTokenUpdate).toHaveBeenCalledWith(expect.any(Function));
  });
});

describe("setOnUnauthorized wiring", () => {
  it("registers logout as the 401 handler on mount, and clears it on unmount", async () => {
    const { unmount } = await renderHook(() => useAuth(), { wrapper: AuthContextProvider });
    expect(setOnUnauthorized).toHaveBeenCalledWith(expect.any(Function));

    await unmount();
    expect(setOnUnauthorized).toHaveBeenLastCalledWith(null);
  });
});

describe("logout", () => {
  it("unregisters the push token, then clears auth state via Logout's callback", async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper: AuthContextProvider });
    await waitFor(() => expect(result.current.isInitializing).toBe(false));
    await act(async () => {
      await result.current.authenticate("some-token");
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(unregisterPushToken).toHaveBeenCalledWith("push-tok");
    expect(Logout).toHaveBeenCalledWith(expect.any(Function));
    await waitFor(() => expect(result.current.token).toBeNull());
    expect(mockOnLogoutCallback).toHaveBeenCalledTimes(1);
  });

  it("still proceeds to Logout even when unregistering the push token fails", async () => {
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockRejectedValue(new Error("no push token"));
    const { result } = await renderHook(() => useAuth(), { wrapper: AuthContextProvider });
    await waitFor(() => expect(result.current.isInitializing).toBe(false));

    await act(async () => {
      await result.current.logout();
    });

    expect(logError).toHaveBeenCalledWith(expect.any(Error), "Unregister push token");
    expect(Logout).toHaveBeenCalledTimes(1);
  });

  it("still forces the client-side logout even when Logout() itself throws", async () => {
    (Logout as jest.Mock).mockRejectedValue(new Error("network down"));
    const { result } = await renderHook(() => useAuth(), { wrapper: AuthContextProvider });
    await waitFor(() => expect(result.current.isInitializing).toBe(false));
    await act(async () => {
      await result.current.authenticate("some-token");
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(logError).toHaveBeenCalledWith(expect.any(Error), "Logout error");
    await waitFor(() => expect(result.current.token).toBeNull());
    expect(mockOnLogoutCallback).toHaveBeenCalledTimes(1);
  });
});
