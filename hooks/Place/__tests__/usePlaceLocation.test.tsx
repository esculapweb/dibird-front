jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("expo-location", () => ({ Accuracy: { High: 6, Balanced: 3 } }));
jest.mock("../../../util/fetches", () => ({ reverseGeocoding: jest.fn() }));
jest.mock("../../useLocationUnavailable", () => ({ useLocationUnavailable: jest.fn() }));
jest.mock("../../../store/location-context", () => ({ useLocation: jest.fn() }));

import { act, renderHook, waitFor } from "@testing-library/react-native";
import { reverseGeocoding } from "../../../util/fetches";
import { useLocationUnavailable } from "../../useLocationUnavailable";
import { useLocation } from "../../../store/location-context";
import { usePlaceLocation, normalizeCoords } from "../usePlaceLocation";

const mockHandleLocationUnavailable = jest.fn();
const mockRequestLocation = jest.fn();

const mockLocationCtx = (overrides: Record<string, unknown> = {}) => {
  (useLocation as jest.Mock).mockReturnValue({
    locationCoords: null,
    permissionStatus: "granted",
    requestLocation: mockRequestLocation,
    ...overrides,
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  (useLocationUnavailable as jest.Mock).mockReturnValue(mockHandleLocationUnavailable);
  (reverseGeocoding as jest.Mock).mockResolvedValue({ country_code: "fr" });
  mockLocationCtx();
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("normalizeCoords", () => {
  it("rounds valid coordinates to the given precision (default 4)", () => {
    expect(normalizeCoords("2.123456", "48.987654")).toEqual({
      lng: 2.1235,
      lat: 48.9877,
      lngText: "2.1235",
      latText: "48.9877",
    });
  });

  it("accepts numeric input as well as strings", () => {
    expect(normalizeCoords(2.5, 48.5)).toEqual({ lng: 2.5, lat: 48.5, lngText: "2.5000", latText: "48.5000" });
  });

  it("returns null for out-of-range latitude/longitude", () => {
    expect(normalizeCoords(2, 91)).toBeNull();
    expect(normalizeCoords(181, 2)).toBeNull();
  });

  it("returns null for non-numeric or empty input", () => {
    expect(normalizeCoords("abc", "48")).toBeNull();
    expect(normalizeCoords("", "48")).toBeNull();
    expect(normalizeCoords(null, "48")).toBeNull();
  });

  it("respects a custom precision", () => {
    expect(normalizeCoords("2.123456", "48.987654", 2)).toEqual({
      lng: 2.12,
      lat: 48.99,
      lngText: "2.12",
      latText: "48.99",
    });
  });

  it("preserves the original string text when preserveInput is set, without rounding the display text", () => {
    const result = normalizeCoords("2.123456789", "48.1", 4, true);
    expect(result?.lngText).toBe("2.123456789");
    expect(result?.latText).toBe("48.1");
    // The numeric value is still rounded even though the text is preserved.
    expect(result?.lng).toBe(2.1235);
  });

  it("falls back to the rounded text when preserveInput is set but the input was already numeric", () => {
    const result = normalizeCoords(2.123456, 48.1, 4, true);
    expect(result?.lngText).toBe("2.1235");
  });
});

describe("locationCoords effect", () => {
  it("adopts a location fed in from the location context on mount", async () => {
    mockLocationCtx({ locationCoords: [2.123456, 48.987654] });
    const { result } = await renderHook(() => usePlaceLocation());

    expect(result.current.coords).toEqual([2.123456, 48.987654]);
    expect(result.current.lngText).toBe("2.1235");
    expect(result.current.latText).toBe("48.9877");
  });

  it("kicks off a debounced reverse-geocode when a location arrives", async () => {
    mockLocationCtx({ locationCoords: [2, 48] });
    await renderHook(() => usePlaceLocation());

    expect(reverseGeocoding).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    expect(reverseGeocoding).toHaveBeenCalledWith(48, 2);
  });
});

describe("updateCoords", () => {
  it("derives lat/lng text from the coordinates by default", async () => {
    const { result } = await renderHook(() => usePlaceLocation());
    await act(async () => {
      result.current.updateCoords([2, 48], { withGeocode: false });
    });
    expect(result.current.lngText).toBe("2.0000");
    expect(result.current.latText).toBe("48.0000");
  });

  it("uses the explicitly provided text instead when fromManual is set", async () => {
    const { result } = await renderHook(() => usePlaceLocation());
    await act(async () => {
      result.current.updateCoords([2, 48], { fromManual: true, lngText: "2,0", latText: "48,0" });
    });
    expect(result.current.lngText).toBe("2,0");
    expect(result.current.latText).toBe("48,0");
  });

  it("skips the reverse-geocode call when withGeocode is false", async () => {
    const { result } = await renderHook(() => usePlaceLocation());
    await act(async () => {
      result.current.updateCoords([2, 48], { withGeocode: false });
      jest.advanceTimersByTime(400);
    });
    expect(reverseGeocoding).not.toHaveBeenCalled();
  });

  it("debounces rapid successive calls into a single geocode for the latest coordinates", async () => {
    const { result } = await renderHook(() => usePlaceLocation());
    await act(async () => {
      result.current.updateCoords([1, 1]);
      result.current.updateCoords([2, 2]);
      jest.advanceTimersByTime(400);
    });
    expect(reverseGeocoding).toHaveBeenCalledTimes(1);
    expect(reverseGeocoding).toHaveBeenCalledWith(2, 2);
  });

  it("sets details from the geocode result, toggling isLoading around it", async () => {
    const { result } = await renderHook(() => usePlaceLocation());
    await act(async () => {
      result.current.updateCoords([2, 48]);
      jest.advanceTimersByTime(400);
    });
    await waitFor(() => expect(result.current.details).toEqual({ country_code: "fr" }));
    expect(result.current.isLoading).toBe(false);
  });

  it("swallows a reverse-geocode failure without crashing, still resetting isLoading", async () => {
    (reverseGeocoding as jest.Mock).mockRejectedValue(new Error("boom"));
    const { result } = await renderHook(() => usePlaceLocation());
    await act(async () => {
      result.current.updateCoords([2, 48]);
      jest.advanceTimersByTime(400);
      await Promise.resolve();
    });
    expect(result.current.details).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });
});

describe("locateMe", () => {
  it("shows the location-unavailable hint instead of requesting when permission is already denied", async () => {
    mockLocationCtx({ permissionStatus: "denied" });
    const { result } = await renderHook(() => usePlaceLocation());

    await act(async () => {
      await result.current.locateMe();
    });

    expect(mockHandleLocationUnavailable).toHaveBeenCalledTimes(1);
    expect(mockRequestLocation).not.toHaveBeenCalled();
    expect(result.current.isLocating).toBe(false);
  });

  it("requests a high-accuracy fix and derives zoom from the returned accuracy", async () => {
    mockRequestLocation.mockResolvedValue({ coords: [2, 48], accuracy: 30 });
    const { result } = await renderHook(() => usePlaceLocation());

    await act(async () => {
      await result.current.locateMe();
    });

    expect(mockRequestLocation).toHaveBeenCalledWith(6);
    expect(result.current.accuracy).toBe(30);
    expect(result.current.zoom).toBe(15);
    expect(result.current.isLocating).toBe(false);
  });

  it.each([
    [10, 17],
    [100, 15],
    [500, 13],
    [2000, 12],
    [5000, 11],
    [10000, 10],
  ])("maps an accuracy of %dm to zoom %d", async (accuracy, expectedZoom) => {
    mockRequestLocation.mockResolvedValue({ coords: [2, 48], accuracy });
    const { result } = await renderHook(() => usePlaceLocation());

    await act(async () => {
      await result.current.locateMe();
    });
    expect(result.current.zoom).toBe(expectedZoom);
  });

  it("defaults to zoom 15 when no usable accuracy is reported", async () => {
    mockRequestLocation.mockResolvedValue({ coords: [2, 48], accuracy: 0 });
    const { result } = await renderHook(() => usePlaceLocation());

    await act(async () => {
      await result.current.locateMe();
    });
    expect(result.current.zoom).toBe(15);
  });

  it("does nothing (no crash) when requestLocation resolves null", async () => {
    mockRequestLocation.mockResolvedValue(null);
    const { result } = await renderHook(() => usePlaceLocation());

    await act(async () => {
      await result.current.locateMe();
    });
    expect(result.current.isLocating).toBe(false);
    expect(result.current.accuracy).toBe(0);
  });

  it("swallows a requestLocation failure without crashing", async () => {
    mockRequestLocation.mockRejectedValue(new Error("gps timeout"));
    const { result } = await renderHook(() => usePlaceLocation());

    await act(async () => {
      await result.current.locateMe();
    });
    expect(result.current.isLocating).toBe(false);
  });

  it("keeps isLocating true across a slow GPS fix, independent of a faster-resolving reverse geocode", async () => {
    let resolveRequestLocation!: (value: unknown) => void;
    mockRequestLocation.mockReturnValue(
      new Promise((resolve) => {
        resolveRequestLocation = resolve;
      }),
    );
    mockLocationCtx({ locationCoords: [2, 48] });
    const { result } = await renderHook(() => usePlaceLocation());

    let locateMeCall!: Promise<void>;
    await act(async () => {
      locateMeCall = result.current.locateMe();
    });
    expect(result.current.isLocating).toBe(true);

    // The debounced reverse-geocode triggered by the already-known
    // locationCoords resolves well before the GPS fix does.
    await act(async () => {
      jest.advanceTimersByTime(400);
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isLocating).toBe(true);

    await act(async () => {
      resolveRequestLocation({ coords: [2, 48], accuracy: 12 });
      await locateMeCall;
    });
    expect(result.current.isLocating).toBe(false);
    expect(result.current.accuracy).toBe(12);
  });
});
