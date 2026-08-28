import { Filters } from "../types";

export const buildDeepLinkParams = (filters: Filters | null = {}, sort: string | null = null): Filters => {
  const params:Filters = {};

  if (filters?.territory) params.territory = filters.territory;
  if (filters?.place) params.place = filters.place;
  if (filters?.species) params.species = filters.species;

  // `private` is the one filter whose "off" value is also a real choice, so it
  // is tested against null rather than for truthiness: `private=false` means
  // "published only", not "no privacy filter".
  if (filters?.private != null) params.private = filters.private;
  if (filters?.source) params.source = filters.source;
  if (filters?.radius) params.radius = filters.radius;

  if (filters?.date) {
    if (filters.date.type === "year") {
      params.year = filters.date.year;
    } else if (filters.date.type === "range") {
      if (filters.date.from) params.date_time_min = formatWebDate(filters.date.from);
      if (filters.date.to) params.date_time_max = formatWebDate(filters.date.to);
    }
  }

  if (sort) params.o = sort;

  return params;
};

const formatWebDate = (date: string | Date | null | undefined): string | null => {
  if (!date) return null;
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};