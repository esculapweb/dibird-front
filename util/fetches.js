import api from "../services/api";
import { isoToFlagEmoji, buildDateParams, cleanFilters } from "./helpers";

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

export const fetchMyPlaces = async (territory = null, coords=null) => {
  if (!territory) return [];

  const params = {
    territory,
    o: coords ? "distance" : "-favourite,name",
  };

if (coords) {
    const [lng, lat] = coords;
    params.lng = lng;
    params.lat = lat;
  }

  const res = await api.get("/myapi/place-dropdown2/", { params });

  return res.data.map((item) => ({
    value:item.id,
    label: item.name,
    iconLabel: item.favourite && "star",
    location: item.location,
    distance: item.distance ?? null,
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
    name: item.sp_latin,
    name_lang: item.sp_name_lang,
    thumb: item.sp_thumb
  }));
};

const fetchAbstract = async (
  fetchUrl,
  filters = {},
  order,
  search = "",
  page = 1,
) => {
  const { date, ...restFilters } = filters;

  const apiFilters = {
    ...restFilters,
    ...buildDateParams(date),
  };

  const params = {
    ...cleanFilters(apiFilters),
    per_page: 100,
    o: order,
  };
  if (search) params.name = search;
  if (page > 1) params.page = page;

  const res = await api.get(fetchUrl, { params });
  return res.data;
};

export const fetchStat = (
  filters,
  order = "ioc_id",
  search,
  page,
  seenMode,
) => {
  filters = { ...filters, seen: seenMode };
  return fetchAbstract("/myapi/stat2/", filters, order, search, page);
};

export const fetchPlaces = (filters, order = "name", search, page) =>
  fetchAbstract("/myapi/place2/", filters, order, search, page);

export const fetchObservations = (filters, order = "-date", search, page) =>
  fetchAbstract("/myapi/observation2/", filters, order, search, page);
