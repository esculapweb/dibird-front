import { useQueryWithTranslation } from "../hooks/useQueryWithTranslation";
import i18n from "../services/i18n";
import api, { showError } from "../services/api";

export const loadDecorator = async (loaderFn) => {
  try {
    await loaderFn();
  } catch (e) {
    showError(e);
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

export const normalizeValue = (value, allowed_values) => {
  if (!value) return allowed_values[0];
  if (!allowed_values.includes(value)) return allowed_values[0];
  return value;
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
    code: label["data-code"],
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

const fetchSpeciesForTerritory = (territory_id, order) => {
  const orderAllowed = ["ioc_id", "name"];
  const params = {
    territory_id: territory_id,
    o: normalizeValue(order, orderAllowed),
  };

  return api.get("/api/territory-species2/", {
    params,
  });
};

export const fetchSeen = async (filters = {}, order = "ioc_id") => {
  const { date, ...restFilters } = filters;

  const apiFilters = {
    ...restFilters,
    ...buildDateParams(date),
  };

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
    const territorySpecies = await fetchSpeciesForTerritory(territory, order);
    notSeenList = territorySpecies.data
      .filter((item) => !idsSet.has(item.taxon_pk))
      .map((item) => ({
        id: item.taxon_pk,
        ...item,
      }));
  }

  return { seenList, notSeenList };
};

export const fetchPlaces = async (
  filters = {},
  order = "name",
  search = "",
  page = 1,
) => {
  let params = {
    ...cleanFilters(filters),
    per_page: 100,
    o: order,
  };
  if (search) params.name = search;
  if (page > 1) params.page = page;

  const res = await api.get("/myapi/place2/", { params });
  return res.data;
};

export const fetchObservations = async (
  filters = {},
  order = "-date",
  search = "",
  page = 1,
) => {

  console.log('fetchObrervations')
  let params = {
    ...cleanFilters(filters),
    per_page: 20,
    o: order,
  };
  if (search) params.name = search;
  if (page > 1) params.page = page;

  const res = await api.get("/myapi/observation2/", { params });

  return res.data;
};
