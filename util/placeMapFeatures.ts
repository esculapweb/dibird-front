import { Coords, LocationType, PlaceItem } from "../types";

// [west, south, east, north] — the shape MapLibre's Camera `bounds` and
// CameraRef.fitBounds take.
export type MapBounds = [number, number, number, number];

export interface PlaceFeatureProperties {
  id: number;
  name: string;
  observation_count: number;
  species_count: number;
  diary_place_count: number;
}

export type PlaceFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: Coords };
  properties: PlaceFeatureProperties;
};

export type PlaceFeatureCollection = {
  type: "FeatureCollection";
  features: PlaceFeature[];
};

// A private location comes back as a bbox polygon rather than a point, with the
// ring's centroid in `center` (see LocationType and generate_bbox_polygon on
// the backend). The map plots one dot per place either way, so the centre is
// exactly what it needs — and only that, never the polygon.
const pointOf = (location: LocationType | null | undefined): Coords | null => {
  if (!location) return null;
  const coords = location.center ?? location.coordinates;
  if (!Array.isArray(coords) || coords.length !== 2) return null;
  const [lng, lat] = coords;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return [lng, lat];
};

export interface FeatureCollectionOptions {
  /**
   * Whether a place whose count is zero still belongs on the map.
   *
   * True for the Places screen, where an empty place is a real place the user
   * created and expects to find. False for the Observations and Diaries maps,
   * where it is noise — the server already drops those (has_observations /
   * has_diaries), so this only catches the offline case where a cached page
   * predates the current filter.
   */
  includeEmpty?: boolean;
  /** Which count decides emptiness — see MapSymbolScale.countProperty. */
  countProperty?: keyof PlaceFeatureProperties;
}

/**
 * Turns places into the source data MapLibre clusters. A place without
 * coordinates is dropped rather than pushed as a broken feature: there is
 * nothing to plot.
 */
export const placesToFeatureCollection = (
  places: PlaceItem[] | undefined,
  {
    includeEmpty = false,
    countProperty = "observation_count",
  }: FeatureCollectionOptions = {},
): PlaceFeatureCollection => ({
  type: "FeatureCollection",
  features: (places ?? []).reduce<PlaceFeature[]>((features, place) => {
    const coordinates = pointOf(place.location);
    if (!coordinates) return features;

    const properties: PlaceFeatureProperties = {
      id: place.id,
      name: place.name,
      observation_count: place.observation_count,
      species_count: place.species_count,
      // Older cached pages predate the field; treating it as zero keeps such a
      // place off the diaries map rather than sizing it from undefined.
      diary_place_count: place.diary_place_count ?? 0,
    };

    if (!includeEmpty && !properties[countProperty]) return features;

    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates },
      properties,
    });
    return features;
  }, []),
});

/** Total actually plotted — the map's header badge. */
export const countTotal = (
  fc: PlaceFeatureCollection,
  countProperty: keyof PlaceFeatureProperties = "observation_count",
): number =>
  fc.features.reduce(
    (total, feature) => total + (feature.properties[countProperty] as number),
    0,
  );

/**
 * Bounding box of every plotted point, for the opening camera. Null when there
 * is nothing to frame; a single point (or several on one coordinate) gives a
 * zero-size box, which fitBounds resolves to that point at max zoom, so
 * callers centre on it instead.
 */
export const boundsFromFeatures = (
  fc: PlaceFeatureCollection,
): MapBounds | null => {
  if (fc.features.length === 0) return null;

  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  for (const feature of fc.features) {
    const [lng, lat] = feature.geometry.coordinates;
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }

  return [west, south, east, north];
};

/** Centre of a bounds box — what the Camera needs when the box has no size. */
export const centerOfBounds = ([west, south, east, north]: MapBounds): Coords => [
  (west + east) / 2,
  (south + north) / 2,
];

/** A zero-size box means every place sits on one coordinate. */
export const isSinglePoint = ([west, south, east, north]: MapBounds): boolean =>
  west === east && south === north;
