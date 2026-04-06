export const buildDeepLinkParams = (filters = {}, sort = null) => {
  const params = {};

  if (filters.territory) params.territory = filters.territory;
  if (filters.place) params.place = filters.place;
  if (filters.species) params.species = filters.species;

  if (filters.date) {
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

const formatWebDate = (date) => {
  if (!date) return null;
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};