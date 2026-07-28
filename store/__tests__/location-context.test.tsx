jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3, High: 4 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

jest.mock("../../services/analytics", () => ({ track: jest.fn() }));

import * as Location from "expo-location";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { track } from "../../services/analytics";
import { LocationProvider, useLocation } from "../location-context";

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("starts with no location and no known permission status", async () => {
  const { result } = await renderHook(() => useLocation(), { wrapper: LocationProvider });
  expect(result.current.locationCoords).toBeNull();
  expect(result.current.locationAvailable).toBe(false);
  expect(result.current.permissionStatus).toBeNull();
  expect(result.current.isRequesting).toBe(false);
});

// `permissionStatus` — состояние текущего рендера, и вызывающий, который
// проверяет его сразу после `await requestLocation()`, видит значение ДО
// запроса. Отсюда геттер: он читает ref, обновляемый в самом запросе.
it("exposes the fresh permission status right after an awaited request", async () => {
  (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
    status: "undetermined",
  });
  (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
    status: "denied",
  });

  const { result } = await renderHook(() => useLocation(), {
    wrapper: LocationProvider,
  });

  const statusAfterAwait = await act(async () => {
    await result.current.requestLocation();
    return result.current.getPermissionStatus();
  });

  expect(statusAfterAwait).toBe("denied");
  expect(result.current.permissionStatus).toBe("denied");
});

describe("requestLocation", () => {
  it("skips the permission prompt and fetches the position directly when already granted", async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: 48.85, longitude: 2.35, accuracy: 10 },
    });

    const { result } = await renderHook(() => useLocation(), { wrapper: LocationProvider });
    let returned: unknown;
    await act(async () => {
      returned = await result.current.requestLocation();
    });

    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: 3 });
    expect(result.current.locationCoords).toEqual([2.35, 48.85]);
    expect(result.current.locationAvailable).toBe(true);
    expect(result.current.permissionStatus).toBe("granted");
    expect(returned).toEqual({ coords: [2.35, 48.85], accuracy: 10 });
  });

  it("forwards a custom accuracy through to getCurrentPositionAsync", async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: 1, longitude: 2, accuracy: null },
    });

    const { result } = await renderHook(() => useLocation(), { wrapper: LocationProvider });
    await act(async () => {
      await result.current.requestLocation(Location.Accuracy.High);
    });

    expect(Location.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: 4 });
  });

  it("prompts for permission when not yet granted, then proceeds on approval", async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "undetermined" });
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: 1, longitude: 2, accuracy: 5 },
    });

    const { result } = await renderHook(() => useLocation(), { wrapper: LocationProvider });
    await act(async () => {
      await result.current.requestLocation();
    });

    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
    expect(result.current.permissionStatus).toBe("granted");
  });

  it("stops without fetching a position when the permission prompt is denied", async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "undetermined" });
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "denied" });

    const { result } = await renderHook(() => useLocation(), { wrapper: LocationProvider });
    let returned: unknown = "not-set";
    await act(async () => {
      returned = await result.current.requestLocation();
    });

    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
    expect(result.current.permissionStatus).toBe("denied");
    expect(result.current.locationAvailable).toBe(false);
    expect(returned).toBeNull();
  });

  it("does not re-prompt when the OS already reports the permission denied", async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "denied" });

    const { result } = await renderHook(() => useLocation(), { wrapper: LocationProvider });
    let returned: unknown = "not-set";
    await act(async () => {
      returned = await result.current.requestLocation();
    });

    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
    expect(result.current.permissionStatus).toBe("denied");
    expect(returned).toBeNull();
  });

  it("swallows a lookup failure (e.g. GPS timeout) and returns null instead of throwing", async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    (Location.getCurrentPositionAsync as jest.Mock).mockRejectedValue(new Error("timed out"));

    const { result } = await renderHook(() => useLocation(), { wrapper: LocationProvider });
    let returned: unknown = "not-set";
    await act(async () => {
      returned = await result.current.requestLocation();
    });

    expect(returned).toBeNull();
    expect(result.current.locationCoords).toBeNull();
    expect(result.current.isRequesting).toBe(false);
  });

  it("shares the in-flight fix with a re-entrant call instead of dropping it", async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    let resolvePosition!: (value: unknown) => void;
    (Location.getCurrentPositionAsync as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolvePosition = resolve;
      }),
    );

    const { result } = await renderHook(() => useLocation(), { wrapper: LocationProvider });

    let firstCall!: Promise<unknown>;
    let secondCall!: Promise<unknown>;
    await act(async () => {
      firstCall = result.current.requestLocation();
    });
    await waitFor(() => expect(result.current.isRequesting).toBe(true));

    await act(async () => {
      secondCall = result.current.requestLocation(Location.Accuracy.High);
    });
    expect(Location.getForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    // The second caller's requested accuracy is moot — it rides along on the
    // fix already in flight rather than triggering a second native lookup.
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);

    let firstReturn: unknown;
    let secondReturn: unknown;
    await act(async () => {
      resolvePosition({ coords: { latitude: 1, longitude: 2, accuracy: 1 } });
      [firstReturn, secondReturn] = await Promise.all([firstCall, secondCall]);
    });

    expect(firstReturn).toEqual({ coords: [2, 1], accuracy: 1 });
    expect(secondReturn).toEqual({ coords: [2, 1], accuracy: 1 });
    expect(result.current.isRequesting).toBe(false);
  });
});

// Вход в аккаунт — не повод показывать системный диалог о геопозиции, поэтому
// фоновым потребителям (App.tsx) нужен режим «возьми, если уже разрешено».
describe("prompt: false", () => {
  it("returns nothing instead of prompting when permission was never asked for", async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "undetermined",
    });

    const { result } = await renderHook(() => useLocation(), {
      wrapper: LocationProvider,
    });
    let returned: unknown;
    await act(async () => {
      returned = await result.current.requestLocation(undefined, {
        prompt: false,
      });
    });

    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(returned).toBeNull();
  });

  // У того, кто разрешение уже дал, ничего не меняется — диалога и так не было.
  it("still fetches the position when permission is already granted", async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "granted",
    });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: 48.85, longitude: 2.35, accuracy: 10 },
    });

    const { result } = await renderHook(() => useLocation(), {
      wrapper: LocationProvider,
    });
    await act(async () => {
      await result.current.requestLocation(undefined, { prompt: false });
    });

    expect(result.current.locationCoords).toEqual([2.35, 48.85]);
  });

  // Молчаливый запрос не должен отвечать за того, кто сам нажал «я здесь»:
  // иначе диалог, который человек попросил, не появится вовсе.
  it("does not let an in-flight silent request answer for a prompting one", async () => {
    let releasePermissions: (v: { status: string }) => void = () => {};
    (Location.getForegroundPermissionsAsync as jest.Mock).mockReturnValueOnce(
      new Promise<{ status: string }>((resolve) => {
        releasePermissions = resolve;
      }),
    );

    const { result } = await renderHook(() => useLocation(), {
      wrapper: LocationProvider,
    });

    let silent: Promise<unknown> = Promise.resolve();
    let prompted: Promise<unknown> = Promise.resolve();
    await act(async () => {
      silent = result.current.requestLocation(undefined, { prompt: false });
      prompted = result.current.requestLocation();

      // The silent one finds no permission and bows out.
      releasePermissions({ status: "undetermined" });

      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "undetermined",
      });
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
        coords: { latitude: 1, longitude: 2, accuracy: 5 },
      });

      await silent;
      await prompted;
    });

    expect(await silent).toBeNull();
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(await prompted).toEqual({ coords: [2, 1], accuracy: 5 });
  });
});

// Событие меряет ответ на диалог. Ставить его на уже известном статусе значило
// бы считать каждый запуск приложения за новый ответ пользователя.
describe("location_permission", () => {
  it("fires when the dialog was actually shown and accepted", async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "undetermined",
    });
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "granted",
    });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: 1, longitude: 2, accuracy: 5 },
    });

    const { result } = await renderHook(() => useLocation(), {
      wrapper: LocationProvider,
    });
    await act(async () => {
      await result.current.requestLocation();
    });

    expect(track).toHaveBeenCalledWith("location_permission", { granted: "yes" });
  });

  it("fires on a refusal too", async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "undetermined",
    });
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "denied",
    });

    const { result } = await renderHook(() => useLocation(), {
      wrapper: LocationProvider,
    });
    await act(async () => {
      await result.current.requestLocation();
    });

    expect(track).toHaveBeenCalledWith("location_permission", { granted: "no" });
  });

  it("stays quiet when permission was granted on an earlier run", async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "granted",
    });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: 1, longitude: 2, accuracy: 5 },
    });

    const { result } = await renderHook(() => useLocation(), {
      wrapper: LocationProvider,
    });
    await act(async () => {
      await result.current.requestLocation();
    });

    expect(track).not.toHaveBeenCalled();
  });

  it("stays quiet when permission was already refused", async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "denied",
    });

    const { result } = await renderHook(() => useLocation(), {
      wrapper: LocationProvider,
    });
    await act(async () => {
      await result.current.requestLocation();
    });

    expect(track).not.toHaveBeenCalled();
  });
});
