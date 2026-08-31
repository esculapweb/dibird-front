import { ObservationSource, Filters, seenMode } from "../types";

interface DeepLinkParams {
  territory?: number | string | null;
  place?: number | string | null;
  species?: number | string | null;
  year?: number | string | null;
  date_time_min?: string | null;
  date_time_max?: string | null;
  private?: boolean | string | null;
  has_photo?: boolean | string | null;
  source?: string | null;
  radius?: number | string | null;
  o?: string | null;
  seenMode?: seenMode | null;
  filtersOverride?: Filters;
}

const SOURCES: readonly ObservationSource[] = ["dibird", "ebird"];

// A link carries `private=true`/`private=false`, and both are a filter — only
// a missing (or unparsable) value means "not filtered by privacy". React
// Navigation hands the value over as a string, an in-app navigation as a
// boolean. `has_photo` is read the same way, for the same reason.
const parseBoolParam = (
  value: boolean | string | null | undefined,
): boolean | null => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return null;
};

const parseRadiusParam = (
  value: number | string | null | undefined,
): number | null => {
  const km = Number(value);
  return value != null && value !== "" && Number.isFinite(km) && km > 0
    ? km
    : null;
};

export const parseDeepLinkParams = (params: DeepLinkParams = {}) => {
  const {
    territory,
    place,
    species,
    year,
    date_time_min,
    date_time_max,
    private: privateParam,
    has_photo: hasPhotoParam,
    source,
    radius,
    o,
    seenMode,
  } = params;

  const filters: Filters = {
    territory: territory ? Number(territory) : null,
    place: place ? Number(place) : null,
    species: species ? Number(species) : null,
    date: null,
  };

  // Set only when the link actually carries them, unlike the four above: a
  // screen that has no such filter (privacy on a shared list, a radius without
  // a device position) should not be handed a key it never asked about — the
  // deep-linked filters replace the screen's own set wholesale.
  const privateValue = parseBoolParam(privateParam);
  if (privateValue !== null) filters.private = privateValue;

  const hasPhotoValue = parseBoolParam(hasPhotoParam);
  if (hasPhotoValue !== null) filters.has_photo = hasPhotoValue;

  const sourceValue = SOURCES.find((s) => s === source) ?? null;
  if (sourceValue) filters.source = sourceValue;

  const radiusValue = parseRadiusParam(radius);
  if (radiusValue) filters.radius = radiusValue;

  if (year) {
    filters.date = {
      type: "year",
      year: Number(year),
    };
  } else if (date_time_min || date_time_max) {
    filters.date = {
      type: "range",
      from: date_time_min ? parseWebDate(date_time_min) : null,
      to: date_time_max ? parseWebDate(date_time_max) : null,
    };
  }

  const sort = o || null;

  const hasParams = !!(
    filters.territory ||
    filters.place ||
    filters.species ||
    filters.date ||
    filters.private != null ||
    filters.has_photo != null ||
    filters.source ||
    filters.radius ||
    sort
  );

  return { filters, sort, hasParams, seenMode: seenMode ?? null };
};

const parseWebDate = (str: string | null): string | null => {
  if (!str) return null;
  const decoded = decodeURIComponent(str);

  // MM/DD/YYYY
  if (decoded.includes("/")) {
    const [month, day, year] = decoded.split("/");
    if (!day || !month || !year) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  // DD.MM.YYYY
  if (decoded.includes(".")) {
    const [day, month, year] = decoded.split(".");
    if (!day || !month || !year) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  // YYYY-MM-DD
  if (decoded.includes("-")) {
    return decoded.slice(0, 10);
  }
  return null;
};
