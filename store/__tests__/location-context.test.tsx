jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3, High: 4 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

import * as Location from "expo-location";
import { act, renderHook, waitFor } from "@testing-library/react-native";
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
