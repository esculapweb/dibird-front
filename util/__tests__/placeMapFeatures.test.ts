import {
  boundsFromFeatures,
  centerOfBounds,
  countTotal,
  isSinglePoint,
  placesToFeatureCollection,
} from "../placeMapFeatures";
import { PlaceItem } from "../../types";

const territoryData = { code: "FR", id: 5, name: "France", segment: "" };

const place = (overrides: Partial<PlaceItem> = {}): PlaceItem => ({
  id: 1,
  name: "Zoo",
  favourite: false,
  location: { type: "Point", coordinates: [0, 0] },
  distance: null,
  preview: null,
  diary_count: 0,
  diary_place_count: 0,
  observation_count: 1,
  species_count: 1,
  territory: 5,
  territory_data: territoryData,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("placesToFeatureCollection", () => {
  it("turns a place into a point feature carrying its counts", () => {
    const fc = placesToFeatureCollection([
      place({
        id: 7,
        name: "Marsh",
        location: { type: "Point", coordinates: [27.56, 53.9] },
        observation_count: 12,
        species_count: 5,
      }),
    ]);

    expect(fc.features).toEqual([
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [27.56, 53.9] },
        properties: {
          id: 7,
          name: "Marsh",
          observation_count: 12,
          species_count: 5,
          diary_place_count: 0,
        },
      },
    ]);
  });

  it("uses the centroid of a private location's bbox polygon", () => {
    // A location_private place comes back as a polygon with `center` on it;
    // the map plots one dot either way and must never unpack the ring.
    const fc = placesToFeatureCollection([
      place({
        location: {
          type: "Polygon",
          coordinates: [10, 20],
          center: [11, 21],
        },
      }),
    ]);

    expect(fc.features[0].geometry.coordinates).toEqual([11, 21]);
  });

  it("drops a place with no coordinates", () => {
    const fc = placesToFeatureCollection([
      place({ location: null as unknown as PlaceItem["location"] }),
    ]);

    expect(fc.features).toEqual([]);
  });

  it("drops a place whose count fell to zero under the filters", () => {
    // The server already excludes these (has_observations); this covers the
    // offline cache, where a stored page can predate the current filter.
    const fc = placesToFeatureCollection([place({ observation_count: 0 })]);

    expect(fc.features).toEqual([]);
  });

  it("keeps an empty place when asked to", () => {
    // The Places screen manages places, so one with no observations is still
    // a place the user made and expects to find on the map.
    const fc = placesToFeatureCollection([place({ observation_count: 0 })], {
      includeEmpty: true,
    });

    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].properties.observation_count).toBe(0);
  });

  it("still drops a place with no coordinates, empty or not", () => {
    const fc = placesToFeatureCollection(
      [place({ location: null as unknown as PlaceItem["location"] })],
      { includeEmpty: true },
    );

    expect(fc.features).toEqual([]);
  });

  it("carries the diary count the diaries map is sized by", () => {
    const fc = placesToFeatureCollection([place({ diary_place_count: 3 })]);

    expect(fc.features[0].properties.diary_place_count).toBe(3);
  });

  it("reads a missing diary count as zero", () => {
    // A place synthesised offline, or a page cached before the field shipped.
    const fc = placesToFeatureCollection([
      place({ diary_place_count: undefined }),
    ]);

    expect(fc.features[0].properties.diary_place_count).toBe(0);
  });

  it("decides emptiness by the count it was asked about", () => {
    // The diaries map must keep a place with outings but no observations, and
    // drop one with observations but no outings.
    const places = [
      place({ id: 1, observation_count: 0, diary_place_count: 2 }),
      place({ id: 2, observation_count: 5, diary_place_count: 0 }),
    ];

    const byDiaries = placesToFeatureCollection(places, {
      countProperty: "diary_place_count",
    });
    const byObservations = placesToFeatureCollection(places);

    expect(byDiaries.features.map((f) => f.properties.id)).toEqual([1]);
    expect(byObservations.features.map((f) => f.properties.id)).toEqual([2]);
  });

  it("survives an empty or missing list", () => {
    expect(placesToFeatureCollection([]).features).toEqual([]);
    expect(placesToFeatureCollection(undefined).features).toEqual([]);
  });
});

describe("countTotal", () => {
  it("sums only what is actually plotted", () => {
    const fc = placesToFeatureCollection([
      place({ id: 1, observation_count: 3 }),
      place({ id: 2, observation_count: 4 }),
      // Invisible on the map, so it must not inflate the badge either.
      place({
        id: 3,
        observation_count: 99,
        location: null as unknown as PlaceItem["location"],
      }),
    ]);

    expect(countTotal(fc)).toBe(7);
  });

  it("sums whichever count it is asked for", () => {
    const fc = placesToFeatureCollection(
      [
        place({ id: 1, diary_place_count: 2 }),
        place({ id: 2, diary_place_count: 3 }),
      ],
      { countProperty: "diary_place_count" },
    );

    expect(countTotal(fc, "diary_place_count")).toBe(5);
  });
});

describe("boundsFromFeatures", () => {
  it("frames every point as [west, south, east, north]", () => {
    const fc = placesToFeatureCollection([
      place({ id: 1, location: { type: "Point", coordinates: [27.56, 53.9] } }),
      place({ id: 2, location: { type: "Point", coordinates: [23.83, 53.68] } }),
      place({ id: 3, location: { type: "Point", coordinates: [25.0, 55.1] } }),
    ]);

    expect(boundsFromFeatures(fc)).toEqual([23.83, 53.68, 27.56, 55.1]);
  });

  it("is null when there is nothing to frame", () => {
    expect(boundsFromFeatures(placesToFeatureCollection([]))).toBeNull();
  });

  it("reports a zero-size box when every place shares one coordinate", () => {
    const fc = placesToFeatureCollection([
      place({ id: 1, location: { type: "Point", coordinates: [27.56, 53.9] } }),
      place({ id: 2, location: { type: "Point", coordinates: [27.56, 53.9] } }),
    ]);
    const bounds = boundsFromFeatures(fc)!;

    expect(isSinglePoint(bounds)).toBe(true);
    expect(centerOfBounds(bounds)).toEqual([27.56, 53.9]);
  });

  it("does not call a real box a single point", () => {
    const fc = placesToFeatureCollection([
      place({ id: 1, location: { type: "Point", coordinates: [27.56, 53.9] } }),
      place({ id: 2, location: { type: "Point", coordinates: [23.83, 53.68] } }),
    ]);

    expect(isSinglePoint(boundsFromFeatures(fc)!)).toBe(false);
  });
});
