import api from "../services/api";
import { isoToFlagEmoji, buildDateParams, cleanFilters } from "./helpers";

export const fetchTimezones = async () => {
  const res = await api.get("/api/timezones2/");
  return res.data.map(([value, label]) => ({
    value,
    label,
  }));
};

export const fetchMyCountries = async (favOnly = false, order) => {
  const params = {
    o: order,
  };
  if (favOnly) params.fav_only = true;
  const res = await api.get("/myapi/territory2/", { params });
  return res.data.map((item) => ({
    value: item.territory_id,
    label: item.name,
    code: item.code,
    icon: isoToFlagEmoji(item.code),
    iconLabelRight: item.favourite && "flag",
  }));
};

export const fetchMyPlaces = async (territory = null, coords = null, order) => {
  if (!territory) return [];

  const isDistanceSort = order === "distance" || order === "-distance";

  const params = {
    territory,
    o: order,
  };

  if (isDistanceSort && coords) {
    const [lng, lat] = coords;
    params.lng = lng;
    params.lat = lat;
  }

  const res = await api.get("/myapi/place-dropdown2/", { params });

  return res.data.map((item) => ({
    value: item.id,
    label: item.name,
    iconLabel: item.favourite && "star",
    location: item.location,
    distance: item.distance ?? null,
    preview: item.preview,
  }));
};

export const fetchSpecies = async (territory = null, order, dateFilter) => {
  if (!territory) return [];
  const params = {
    territory,
    per_page: 2500,
    o: order,
    ...buildDateParams(dateFilter),
  };
  const res = await api.get("/myapi/stat2/", { params });

  return res.data?.results.map((item) => ({
    value: item.species_id,
    label: item.sp_name,
    name: item.sp_latin,
    name_lang: item.sp_name_lang,
    thumb: item.sp_thumb,
    seen: item.seen,
  }));
};

export const fetchDiarySpeciesIds = async (diaryId) => {
  const params = {
    diary: diaryId,
  };
  const res = await api.get("/myapi/diary-observation2/species-ids/", {
    params,
  });
  return res.data;
};

export const fetchMapPreview = async (placeId) => {
  const res = await api.get(`/myapi/place2/${placeId}/map_preview/`);
  return res.data;
};

export const fetchUserProfile = async (profileId) => {
  const res = await api.get(`/myapi/user-profile/${profileId}/`);
  return res.data;
};

export const fetchMyActivity = async (filters) => {
  const params = {
    territory: filters?.territory,
    ...buildDateParams(filters?.date),
    ...(filters?.new && { new: true }),
  };

  const res = await api.get("/myapi/observation2/activity/", { params });

  return res.data;
};

export const fetchMyDashboardStat = async (filters) => {
  const params = {
    territory: filters?.territory,
    ...buildDateParams(filters?.date),
  };

  const res = await api.get("/myapi/dashboard-stats2/", { params });
  return res.data;
};

const fetchAbstract = async (
  fetchUrl,
  filters = {},
  order,
  search = "",
  page = 1,
  extraParams = {},
) => {
  const { date, ...restFilters } = filters;

  const apiFilters = {
    ...restFilters,
    ...buildDateParams(date),
  };

  const params = {
    ...cleanFilters(apiFilters),
    ...extraParams,
    per_page: 100,
    o: order,
  };
  if (search) params.name = search;
  if (page > 1) params.page = page;

  const res = await api.get(fetchUrl, { params });
  return res.data;
};

export const fetchStat = (filters, order = "-date_time", search, page) => {
  filters = { ...filters };
  return fetchAbstract("/myapi/stat2/", filters, order, search, page);
};

export const fetchChecklist = (filters, order = "-ioc_id", search, page) => {
  filters = { ...filters };
  return fetchAbstract("/myapi/checklist2/", filters, order, search, page);
};

export const fetchPlaces = (
  filters,
  order = "distance",
  search,
  page,
  coords = null,
) => {
  const isDistanceSort = order === "distance" || order === "-distance";
  const extraParams =
    isDistanceSort && coords ? { lng: coords[0], lat: coords[1] } : {};
  return fetchAbstract(
    "/myapi/place2/",
    filters,
    order,
    search,
    page,
    extraParams,
  );
};

export const fetchObservations = (
  filters,
  order = "-date_time",
  search,
  page,
) => fetchAbstract("/myapi/observation2/", filters, order, search, page);

export const fetchDiaries = (filters, order = "-date_time", search, page) =>
  fetchAbstract("/myapi/diary2/", filters, order, search, page);

export const fetchDiaryObservations = (
  filters,
  order = "-created_at",
  search,
  page,
  id,
) => {
  return fetchAbstract(
    "/myapi/diary-observation2/",
    filters,
    order,
    search,
    page,
  );
};

export const fetchRating = (filters, order = "-observations", search, page) => {
  filters = { ...filters };
  return fetchAbstract("/myapi/rating2/", filters, order, search, page);
};

export const fetchRatingCompareHeader = async (profile1, profile2, filters) => {
  const { date, ...restFilters } = filters;

  const apiFilters = {
    ...restFilters,
    ...buildDateParams(date),
  };

  const params = {
    profile1,
    profile2,
    ...apiFilters,
  };
  const res = await api.get(`/myapi/rating-compare2-header/`, { params });
  return res.data;
};

export const fetchRatingCompare = (filters, order = "ioc_id", search, page) => {
  filters = { ...filters };
  return fetchAbstract("/myapi/rating-compare2/", filters, order, search, page);
};
