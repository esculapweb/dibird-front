import { Filters } from "../types";

interface DeepLinkParams {
  territory?: number | string | null;
  place?: number | string | null;
  species?: number | string | null;
  year?: number | string | null;
  date_time_min?: string | null;
  date_time_max?: string | null;
  o?: string | null;
  seenMode?: string | null;
  filtersOverride?: Filters;
}

export const parseDeepLinkParams = (params: DeepLinkParams = {}) => {
  const {
    territory,
    place,
    species,
    year,
    date_time_min,
    date_time_max,
    o,
    seenMode,
  } = params;

  const filters: Filters = {
    territory: territory ? Number(territory) : null,
    place: place ? Number(place) : null,
    species: species ? Number(species) : null,
    date: null,
  };

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
    return decoded.slice(0, 10); // обрезаем лишнее
  }
  return null;
};
