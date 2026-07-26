import { useMemo } from "react";

import { useFilters } from "../store/filters-context";
import { useProfile } from "../store/profile-context";
import { getCachedCountries } from "./repositories/referenceRepository";
import { getSession } from "../util/sessionStore";
import { TaxonCountry } from "../types";

// The country a new record starts on when the screen that opened the editor
// has no country of its own to hand over. Ordered by how recently the user
// said it: what they last saved in this session beats a global filter they
// set days ago, which beats the country sitting on their profile. Like the
// "lastDate" fallback in useEditorForm, the session half lives only until the
// app restarts — util/sessionStore is in memory.
//
// `countries` is a species' recorded range, when the caller knows one. A
// default carried over from a stale filter must not seed a record in a
// country the species has never been recorded in, so a candidate outside the
// range resolves to null ("no default, let the user pick") rather than
// falling through to the next candidate — those are just as stale, and the
// user is standing on the page that says where this bird occurs.
export const useDefaultTerritory = (
  countries?: TaxonCountry[],
): number | null => {
  const { territory } = useFilters();
  const { profile } = useProfile();

  const candidate =
    getSession<number>("lastTerritory") ??
    territory ??
    profile?.territory ??
    null;

  return useMemo(() => {
    if (candidate === null || !countries?.length) return candidate;

    // Matching against the range needs the territory's ISO code, which only
    // the countries dropdown carries. It is mirrored in SQLite for offline
    // use, but on a fresh install nothing has fetched it yet — with no way to
    // tell, the candidate stands rather than being thrown away.
    const code = getCachedCountries("name").find(
      (country) => Number(country.value) === candidate,
    )?.code;
    if (!code) return candidate;

    return countries.some(
      (country) => country.code.toLowerCase() === code.toLowerCase(),
    )
      ? candidate
      : null;
  }, [candidate, countries]);
};
