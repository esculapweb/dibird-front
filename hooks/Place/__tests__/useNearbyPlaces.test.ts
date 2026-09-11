import {
  findNearbyPlaces,
  strongThresholdFor,
  MAX_NEAR_THRESHOLD_M,
  NEAR_THRESHOLD_M,
} from "../useNearbyPlaces";
import { Coords, PlaceDropdownItem } from "../../../types";

// Everything is measured from this point. One degree of latitude is ~111 km,
// so the offsets below are metres expressed in degrees.
const HERE: Coords = [2.35, 48.86];
const metresNorth = (m: number): Coords => [HERE[0], HERE[1] + m / 111_320];

const place = (
  value: number,
  distanceM: number | null,
  extra: Partial<PlaceDropdownItem> = {},
): PlaceDropdownItem => ({
  value,
  label: `Place ${value}`,
  ...(distanceM == null
    ? {}
    : { location: { type: "Point", coordinates: metresNorth(distanceM) } }),
  ...extra,
});

describe("strongThresholdFor", () => {
  it("uses the plain threshold when the accuracy is unknown", () => {
    expect(strongThresholdFor(null)).toBe(NEAR_THRESHOLD_M);
    expect(strongThresholdFor(undefined)).toBe(NEAR_THRESHOLD_M);
  });

  it("never narrows below the plain threshold, however good the fix is", () => {
    expect(strongThresholdFor(5)).toBe(NEAR_THRESHOLD_M);
  });

  it("widens to a poor fix, but only up to the ceiling", () => {
    expect(strongThresholdFor(180)).toBe(180);
    expect(strongThresholdFor(900)).toBe(MAX_NEAR_THRESHOLD_M);
  });
});

describe("findNearbyPlaces", () => {
  it("returns nothing without coordinates or places", () => {
    expect(findNearbyPlaces({ coords: null, places: [place(1, 10)] }).nearest).toBeNull();
    expect(findNearbyPlaces({ coords: HERE, places: [] }).nearest).toBeNull();
    expect(findNearbyPlaces({ coords: HERE, places: undefined }).nearest).toBeNull();
  });

  it("ranks by distance and keeps the nearest as the proposed answer", () => {
    const result = findNearbyPlaces({
      coords: HERE,
      places: [place(1, 300), place(2, 40), place(3, 120)],
    });

    expect(result.nearest!.place.value).toBe(2);
    expect(result.nearest!.distanceM).toBe(40);
    expect(result.others.map((o) => o.place.value)).toEqual([3, 1]);
  });

  it("caps the list at three — past that it is a picker, not a hint", () => {
    const result = findNearbyPlaces({
      coords: HERE,
      places: [place(1, 10), place(2, 20), place(3, 30), place(4, 40)],
    });

    expect([result.nearest!, ...result.others]).toHaveLength(3);
  });

  it("drops anything past the quiet radius entirely", () => {
    expect(findNearbyPlaces({ coords: HERE, places: [place(1, 600)] }).nearest).toBeNull();
  });

  it("ignores places the server sent without a location", () => {
    const result = findNearbyPlaces({
      coords: HERE,
      places: [place(1, null), place(2, 50)],
    });

    expect(result.nearest!.place.value).toBe(2);
    expect(result.others).toEqual([]);
  });

  it("never offers the place that is already picked", () => {
    const result = findNearbyPlaces({
      coords: HERE,
      places: [place(1, 30), place(2, 80)],
      excludeId: 1,
    });

    expect(result.nearest!.place.value).toBe(2);
  });

  describe("tone", () => {
    it("claims the same spot inside the threshold, and only hints outside it", () => {
      expect(findNearbyPlaces({ coords: HERE, places: [place(1, 60)] }).isStrong).toBe(true);
      expect(findNearbyPlaces({ coords: HERE, places: [place(1, 300)] }).isStrong).toBe(false);
    });

    it("lets a poor fix widen what counts as the same spot", () => {
      const places = [place(1, 200)];
      expect(findNearbyPlaces({ coords: HERE, places }).isStrong).toBe(false);
      expect(findNearbyPlaces({ coords: HERE, accuracy: 220, places }).isStrong).toBe(true);
    });

    it("says nothing at all when the fix is too coarse to mean anything", () => {
      expect(
        findNearbyPlaces({ coords: HERE, accuracy: 1500, places: [place(1, 20)] }).nearest,
      ).toBeNull();
    });
  });
});
