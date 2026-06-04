import { Platform } from "react-native";

import api from "../services/api";
import { isoToFlagEmoji, buildDateParams, cleanFilters } from "./helpers";
import {
  Filters,
  DateFilter,
  PaginatedResponse,
  StatPaginatedResponse,
  SpeciesItem,
  Coords,
  ChecklistItem,
  PlaceItemBase,
  TerritoryDropdownItem,
  PlaceDropdownItem,
  SpeciesDropdownItem,
  ObservationItem,
  RatingCompareItem,
  RatingItem,
  DiaryObservationItem,
  PlaceItem,
  BirdOfTheDayType,
  ActivityResponse,
  DiaryListItem,
  GdprExport,
  AppNotification,
} from "../types";

export const exportProfileData = async (): Promise<void> => {
  await api.post(`/myapi/gdpr/`);
};

export const pollExportStatus = async () => {
  const res = await api.get<GdprExport>("/myapi/gdpr/status/");
  return res.data;
};

export const fetchTimezones = async () => {
  const res = await api.get<[string, string][]>("/api/timezones2/");
  return res.data.map(([value, label]) => ({
    value,
    label,
  }));
};

export const fetchPage = async (slug: string) => {
  const res = await api.get(`/api/page2/${slug}/`);
  return res.data?.content;
};

interface CountryItem {
  territory_id: number;
  name: string;
  code: string;
  favourite: boolean;
}

export const fetchMyCountries = async (
  favOnly = false,
  order: string,
): Promise<TerritoryDropdownItem[]> => {
  const params: { o: string; fav_only?: boolean } = {
    o: order,
  };
  if (favOnly) params.fav_only = true;
  const res = await api.get<CountryItem[]>("/myapi/territory2/", { params });
  return res.data.map((item) => ({
    value: item.territory_id,
    label: item.name,
    code: item.code,
    icon: isoToFlagEmoji(item.code),
    iconLabelRight: item.favourite ? ("flag" as const) : undefined,
  }));
};

export const fetchMyPlaces = async (
  territory: number | null = null,
  coords: Coords | null = null,
  order: string,
): Promise<PlaceDropdownItem[]> => {
  if (!territory) return [];

  const isDistanceSort = order === "distance" || order === "-distance";

  const params: {
    territory: number | null;
    o: string;
    lng?: number;
    lat?: number;
  } = {
    territory,
    o: order,
  };

  if (isDistanceSort && coords) {
    const [lng, lat] = coords;
    params.lng = lng;
    params.lat = lat;
  }

  const res = await api.get<PlaceItemBase[]>("/myapi/place-dropdown2/", {
    params,
  });

  return res.data.map((item) => ({
    value: item.id,
    label: item.name,
    iconLabel: item.favourite ? ("star" as const) : undefined,
    location: item.location,
    distance: item.distance ?? undefined,
    preview: item.preview ?? undefined,
  }));
};

export const fetchSpecies = async (
  territory: number | null = null,
  order: string,
  dateFilter?: DateFilter,
): Promise<SpeciesDropdownItem[]> => {
  if (!territory) return [];
  const params = {
    territory,
    per_page: 2500,
    o: order,
    ...buildDateParams(dateFilter),
  };
  const res = await api.get<PaginatedResponse<SpeciesItem>>("/myapi/stat2/", {
    params,
  });

  return res.data?.results.map((item) => ({
    value: item.species_id,
    label: item.sp_name,
    name: item.sp_latin,
    name_lang: item.sp_name_lang,
    thumb: item.sp_thumb ?? undefined,
    seen: item.seen,
    segment: item.segment,
  }));
};

export const fetchDiarySpeciesIds = async (diaryId: number) => {
  const params = {
    diary: diaryId,
  };
  const res = await api.get("/myapi/diary-observation2/species-ids/", {
    params,
  });
  return res.data;
};

export const fetchMapPreview = async (placeId: string | number | null) => {
  const res = await api.get(`/myapi/place2/${placeId}/map_preview/`);
  return res.data;
};

export const fetchUserProfile = async (profileId: number) => {
  const res = await api.get(`/myapi/user-profile/${profileId}/`);
  return res.data;
};

export const fetchMyActivity = async (filters: Filters) => {
  const params = {
    territory: filters?.territory,
    ...buildDateParams(filters?.date),
    ...(filters?.new && { new: true }),
  };

  const res = await api.get<ActivityResponse>("/myapi/observation2/activity/", {
    params,
  });

  return res.data;
};

export const fetchMyDashboardStat = async (filters: Filters) => {
  const params = {
    territory: filters?.territory,
    ...buildDateParams(filters?.date),
  };

  const res = await api.get("/myapi/dashboard-stats2/", { params });
  return res.data;
};

export const fetchBirdOfDay = async (territory: number | null) => {
  const params = {
    territory: territory,
  };

  const res = await api.get<BirdOfTheDayType>("/myapi/bird-of-day2/today/", {
    params,
  });
  return res.data;
};

const fetchAbstract = async <T>(
  fetchUrl: string,
  filters: Filters = {},
  order: string | null,
  search = "",
  page = 1,
  extraParams: Record<string, unknown> = {},
): Promise<T> => {
  const { date, ...restFilters } = filters;

  const apiFilters = {
    ...restFilters,
    ...buildDateParams(date),
  };

  const params: Record<string, unknown> = {
    ...cleanFilters(apiFilters),
    ...extraParams,
    per_page: 100,
    o: order,
  };
  if (search) params.name = search;
  if (page > 1) params.page = page;

  const res = await api.get<T>(fetchUrl, { params });
  return res.data;
};

export const fetchStat = (
  filters: Filters,
  order: string | null = "name",
  search: string,
  page?: number,
) => {
  filters = { ...filters };
  return fetchAbstract<StatPaginatedResponse<SpeciesItem>>(
    "/myapi/stat2/",
    filters,
    order,
    search,
    page,
  );
};

export const fetchChecklist = (
  filters: Filters,
  order: string | null = "-ioc_id",
  search?: string,
  page?: number,
) => {
  filters = { ...filters };
  return fetchAbstract<StatPaginatedResponse<ChecklistItem>>(
    "/myapi/checklist2/",
    filters,
    order,
    search,
    page,
  );
};

export const fetchPlaces = (
  filters: Filters,
  order: string | null = "distance",
  search?: string,
  page?: number,
  coords?: Coords | null,
) => {
  const isDistanceSort = order === "distance" || order === "-distance";
  const extraParams =
    isDistanceSort && coords ? { lng: coords[0], lat: coords[1] } : {};
  return fetchAbstract<PaginatedResponse<PlaceItem>>(
    "/myapi/place2/",
    filters,
    order,
    search,
    page,
    extraParams,
  );
};

export const fetchObservations = (
  filters: Filters,
  order: string | null = "species_name",
  search?: string,
  page?: number,
) =>
  fetchAbstract<PaginatedResponse<ObservationItem>>(
    "/myapi/observation2/",
    filters,
    order,
    search,
    page,
  );

export const fetchDiaries = (
  filters: Filters,
  order: string | null = "-date_time,-created_at",
  search?: string,
  page?: number,
) =>
  fetchAbstract<PaginatedResponse<DiaryListItem>>(
    "/myapi/diary2/",
    filters,
    order,
    search,
    page,
  );

export const fetchDiaryObservations = (
  filters: Filters,
  order: string | null = "-created_at",
  search?: string,
  page?: number,
) => {
  return fetchAbstract<PaginatedResponse<DiaryObservationItem>>(
    "/myapi/diary-observation2/",
    filters,
    order,
    search,
    page,
  );
};

export const fetchRating = (
  filters: Filters,
  order: string | null = "-observations",
  search?: string,
  page?: number,
) => {
  filters = { ...filters };
  return fetchAbstract<PaginatedResponse<RatingItem>>(
    "/myapi/rating2/",
    filters,
    order,
    search,
    page,
  );
};

export const fetchRatingCompareHeader = async (
  profile1: number,
  profile2: number,
  filters: Filters | null,
) => {
  const { date, ...restFilters } = filters ?? {};

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

export const fetchRatingCompare = (
  filters: Filters,
  order: string | null = "ioc_id",
  search?: string,
  page?: number,
) => {
  filters = { ...filters };
  return fetchAbstract<PaginatedResponse<RatingCompareItem>>(
    "/myapi/rating-compare2/",
    filters,
    order,
    search,
    page,
  );
};

export const fetchNotifications = async (page = 1) => {
  const res = await api.get<PaginatedResponse<AppNotification>>(
    "/myapi/notifications/",
    { params: { page } },
  );
  return res.data;
};

export const fetchUnreadCount = async (): Promise<number> => {
  const res = await api.get('/myapi/notifications/unread-count/')
  return res.data.count
}

export const markNotificationsRead = async (ids?: number[]): Promise<void> => {
  const body = ids ? { ids } : { all: true };
  await api.post("/myapi/notifications/read/", body);
};

export const registerPushToken = async (token: string): Promise<void> => {
  await api.post('/myapi/push-token/', {
    token,
    platform: Platform.OS, // 'ios' | 'android'
  })
}

export const unregisterPushToken = async (token: string): Promise<void> => {
  await api.delete(`/myapi/push-tokens/${encodeURIComponent(token)}/`)
}