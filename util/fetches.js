import i18n from "../services/i18n";
import api from "../services/api";

export const loadDecorator = async (loaderFn) => {
  try {
    await loaderFn();
  } catch (e) {
    console.warn(
      `[${new Date().toLocaleString()}] Failed to load data`,
      e.code,
      e.message,
    );
  }
};

export const isoToFlagEmoji = (isoCode) => {
  if (!isoCode) return "";
  return isoCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt()));
};

export const formatDate = (isoDate) =>
  new Intl.DateTimeFormat(i18n.language, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(new Date(isoDate));

const toDateOnly = (value) =>
  value ? new Date(value).toISOString().slice(0, 10) : null;

const buildDateParams = (date) => {
  if (!date || date.type === "any") return {};

  switch (date.type) {
    case "year":
      return {
        date_time_min: `${date.year}-01-01 00:00:00`,
        date_time_max: `${date.year}-12-31 23:59:59`,
      };

    case "range":
      return {
        ...(date.from && {
          date_time_min: `${toDateOnly(date.from)} 00:00:00`,
        }),
        ...(date.to && { date_time_max: `${toDateOnly(date.to)} 23:59:59` }),
      };

    default:
      return {};
  }
};

const cleanFilters = (filters) =>
  Object.fromEntries(Object.entries(filters).filter(([_, v]) => v != null));

export const fetchTimezones = async () => {
  const res = await api.get("/api/timezones/");
  return res.data.map(([value, label]) => ({
    value,
    label,
  }));
};

export const fetchCountries = async () => {
  const res = await api.get("/api/territory-dropdown-my/");
  return res.data.map(([value, label]) => ({
    value,
    label: label.label,
    icon: isoToFlagEmoji(label["data-code"]),
  }));
};

export const fetchMyCountries = async (favOnly = false) => {
  const params = favOnly ? { fav_only: favOnly } : {};
  const res = await api.get("/myapi/territory2/", { params });
  return res.data.map((item) => ({
    value: item.territory_id,
    label: item.name,
    icon: isoToFlagEmoji(item.code),
    iconLabel: item.favourite && "star",
  }));
};

export const fetchMyPlaces = async (territory = null) => {
  const params = {
    o: "-favourite,name",
  };
  if (territory) params.territory = territory;
  const res = await api.get("/myapi/place-dropdown/", { params });

  return res.data.map(([value, item]) => ({
    value,
    label: item.label,
    iconLabel: item["data-favourite"] && "star",
  }));
};

const fetchSpeciesForTerritory = (territory_id) => {
  return api.get(`/api/territory-species/?territory_id=${territory_id}`);
};

export const fetchSeen = async (filters = {}, order = "name") => {
  const { date, ...restFilters } = filters;

  const apiFilters = {
    ...restFilters,
    ...buildDateParams(date),
  };

  console.log(apiFilters)

  const params = {
    ...cleanFilters(apiFilters),
    per_page: 20000,
    o: order,
  };

  let notSeenList = [];
  const stat = await api.get("/myapi/stat/", {
    params,
  });

  const idsSet = new Set(stat?.data?.results.map((item) => item.species));

  const seenList = stat?.data?.results.map((item) => ({
    id: item.species,
    ...item,
  }));

  const territory = restFilters?.territory;
  if (territory) {
    const territorySpecies = await fetchSpeciesForTerritory(territory);
    notSeenList = Object.entries(territorySpecies.data)
      .filter(([speciesId]) => !idsSet.has(Number(speciesId)))
      .map(([speciesId, sp]) => ({
        id: Number(speciesId),
        ...sp,
      }))
      .sort((a, b) =>
        a.sp_name_lang.localeCompare(b.sp_name_lang, i18n.language),
      );
  }

  return { seenList, notSeenList };
};
