import api, { showError } from "../services/api";
import {
  isoToFlagEmoji,
  normalizeValue,
  buildDateParams,
  cleanFilters,
} from "./helpers";

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

export const fetchTimezones = async () => {
  const res = await api.get("/api/timezones/");
  return res.data.map(([value, label]) => ({
    value,
    label,
  }));
};

export const fetchMyCountries = async (favOnly = false) => {
  const params = favOnly ? { fav_only: true } : {};
  const res = await api.get("/myapi/territory2/", { params });
  return res.data.map((item) => ({
    value: item.territory_id,
    label: item.name,
    code: item.code,
    icon: isoToFlagEmoji(item.code),
    iconLabel: item.favourite && "star",
  }));
};

export const fetchMyPlaces = async (territory = null) => {
  const params = {
    o: "-favourite,name",
  };
  if (!territory) return [];
  params.territory = territory;
  const res = await api.get("/myapi/place-dropdown/", { params });

  return res.data.map(([value, item]) => ({
    value,
    label: item.label,
    iconLabel: item["data-favourite"] && "star",
  }));
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
  const { date, ...restFilters } = filters;

  const apiFilters = {
    ...restFilters,
    ...buildDateParams(date),
  };

  let params = {
    ...cleanFilters(apiFilters),
    per_page: 100,
    o: order,
  };
  if (search) params.name = search;
  if (page > 1) params.page = page;

  const res = await api.get("/myapi/observation2/", { params });

  return res.data;
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

  const res = await api.get("/myapi/stat/", { params });

  return res?.data?.results.map((item) => ({
    id: item.species_id,
    ...item,
  }));
};

export const fetchNotSeen = async (filters = {}, order = "ioc_id") => {
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

  if (!restFilters?.territory) return [];

  const res = await api.get("/myapi/notseen/", { params });
  return res?.data?.results.map((item) => ({
    id: item.species_id,
    ...item,
  }));
};

export const fetchSpecies = async (territory = null) => {
  const params = {
    o: "ioc_id",
  };
  if (!territory) return [];
  params.territory_id = territory;
  const res = await api.get("/api/territory-species2/", { params });
  return res.data.map((item) => ({
    value: item.taxon_pk,
    label: item.sp_name,
    labelLang: item.sp_name_lang,
  }));
};
