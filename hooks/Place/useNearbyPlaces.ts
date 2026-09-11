import { useMemo } from "react";

import { distanceKm } from "../../util/helpers";
import { Coords, PlaceDropdownItem } from "../../types";

// "This is almost certainly the same spot." Deliberately generous next to a
// good GPS fix (5-20 m): a birding place is a pond or a stretch of forest
// edge, not a doorway, so the pin can sit a fair way from wherever the last
// observation at that place was actually taken.
export const NEAR_THRESHOLD_M = 100;

// Past the strong threshold and up to this, a place is only worth mentioning
// quietly — "there are places of yours around here", not "you are here".
export const NEARBY_THRESHOLD_M = 500;

// A fix this coarse cannot support any claim about a 100 m neighbourhood, so
// nothing is suggested at all rather than something confidently wrong.
export const MAX_USABLE_ACCURACY_M = 1000;

// Ceiling for the accuracy-widened strong threshold: past this the suggestion
// stops meaning "the same spot" no matter how bad the fix is.
export const MAX_NEAR_THRESHOLD_M = 250;

// Nearest plus two. A longer list is a picker, not a hint — and the picker
// already exists right below.
export const MAX_NEARBY_SUGGESTIONS = 3;

export interface NearbyPlace {
  place: PlaceDropdownItem;
  distanceM: number;
}

export interface NearbyPlacesResult {
  nearest: NearbyPlace | null;
  others: NearbyPlace[];
  /**
   * Whether the nearest one is close enough to claim the user is standing at
   * it, as opposed to merely somewhere in its neighbourhood. Drives which of
   * the two suggestion tones the UI takes.
   */
  isStrong: boolean;
}

interface FindNearbyPlacesArgs {
  /** Point to measure from: the dropped pin in the place editor, the live GPS fix in a form. */
  coords: Coords | null | undefined;
  /**
   * Accuracy of the fix `coords` came from, in metres, or null when it is not
   * a fix at all (a hand-placed pin) or is simply unknown. Only ever widens
   * the strong threshold, never narrows it.
   */
  accuracy?: number | null;
  places: PlaceDropdownItem[] | undefined;
  /** Place already picked/edited — never suggest something as its own neighbour. */
  excludeId?: number | string | null;
}

const EMPTY: NearbyPlacesResult = {
  nearest: null,
  others: [],
  isStrong: false,
};

export const strongThresholdFor = (
  accuracy: number | null | undefined,
): number =>
  accuracy == null
    ? NEAR_THRESHOLD_M
    : Math.min(MAX_NEAR_THRESHOLD_M, Math.max(NEAR_THRESHOLD_M, accuracy));

export const findNearbyPlaces = ({
  coords,
  accuracy,
  places,
  excludeId,
}: FindNearbyPlacesArgs): NearbyPlacesResult => {
  if (!coords || !places?.length) return EMPTY;
  if (accuracy != null && accuracy > MAX_USABLE_ACCURACY_M) return EMPTY;

  const ranked = places
    .filter(
      (place) =>
        place.value !== excludeId && !!place.location?.coordinates,
    )
    .map((place) => ({
      place,
      distanceM: Math.round(
        distanceKm(coords, place.location!.coordinates) * 1000,
      ),
    }))
    .filter((candidate) => candidate.distanceM <= NEARBY_THRESHOLD_M)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, MAX_NEARBY_SUGGESTIONS);

  if (ranked.length === 0) return EMPTY;

  return {
    nearest: ranked[0],
    others: ranked.slice(1),
    isStrong: ranked[0].distanceM <= strongThresholdFor(accuracy),
  };
};

/**
 * The user's own places sitting within a few hundred metres of a point,
 * nearest first — the data behind "is this maybe the place you already have?".
 *
 * Entirely client-side, and deliberately so: `fetchMyPlaces` already hands the
 * dropdown every place in the territory with its `location` attached, and that
 * response is cached, so the suggestion keeps working in the field with no
 * connection — which is the only place it actually matters.
 */
export const useNearbyPlaces = (
  args: FindNearbyPlacesArgs,
): NearbyPlacesResult => {
  const { coords, accuracy, places, excludeId } = args;

  return useMemo(
    () => findNearbyPlaces({ coords, accuracy, places, excludeId }),
    // coords is a fresh array on every GPS tick; compare by value so a pin
    // that has not actually moved does not re-rank the whole list.
    [coords?.[0], coords?.[1], accuracy, places, excludeId],
  );
};
