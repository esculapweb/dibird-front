import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

import api from "../services/api";
import {
  isoToFlagEmoji,
  buildDateParams,
  cleanFilters,
  stableStringify,
} from "./helpers";
import i18n from "../services/i18n";
import { Config } from "../constants/config";
import {
  cacheCountries,
  cacheTimezones,
  getCachedCountries,
  getCachedTimezones,
} from "../hooks/repositories/referenceRepository";
import {
  cacheListResponse,
  getCachedListResponse,
  getCachedListResponseByPrefix,
  CacheTable,
} from "../hooks/repositories/listCacheRepository";
import * as observationRepository from "../hooks/repositories/observationRepository";
import * as diaryRepository from "../hooks/repositories/diaryRepository";
import * as placeRepository from "../hooks/repositories/placeRepository";
import {
  speciesDropdownCacheTable,
  placesDropdownCacheTable,
  statCacheTable,
  checklistCacheTable,
  placesListCacheTable,
  observationsListCacheTable,
  diariesListCacheTable,
  diaryObservationsListCacheTable,
  ratingCacheTable,
  ratingCompareCacheTable,
  ratingCompareHeaderCacheTable,
  communityObservationsCacheTable,
} from "../services/db/schema";

// Shared cap for every dedicated offline-cache table (see the cacheTable
// factory in services/db/schema.ts and hooks/repositories/listCacheRepository.ts
// for why one table per data kind, and why a single flat cap is fine — the
// eviction cost barely depends on it, and this bounds the number of distinct
// cached *queries*, not the size of any one of them (e.g. one row per
// territory/sort/date-filter combo for species, however many species that
// territory has).
const MAX_ENTRIES = 3000;
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
  CountryItem,
  Profile,
  ImageAsset,
  AvatarResponse,
  ReverseGeocode,
  emptyPaginatedResponse,
} from "../types";

export const exportProfileData = async (): Promise<void> => {
  await api.post(`/myapi/gdpr/`);
};

export const pollExportStatus = async (): Promise<GdprExport> => {
  const res = await api.get("/myapi/gdpr/status/");
  return res.data;
};

export const downloadExportFile = async (
  data: GdprExport,
  token: string | null,
) => {
  const url = `${Config.baseUrl}/myapi/gdpr/download/?token=${data.download_token}`;
  const dest = FileSystem.documentDirectory + "dibird_export.zip";
  return FileSystem.downloadAsync(url, dest, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const fetchTimezones = async () => {
  try {
    const res = await api.get<[string, string][]>("/api/timezones2/");
    const items = res.data.map(([value, label]) => ({
      value,
      label,
    }));
    cacheTimezones(items);
    return items;
  } catch (e) {
    const cached = getCachedTimezones();
    if (cached.length > 0) return cached;
    throw e;
  }
};

export const fetchPage = async (slug: string) => {
  const res = await api.get(`/api/page2/${slug}/`);
  return res.data?.content;
};

export const fetchMyCountries = async (
  favOnly = false,
  order: string,
): Promise<TerritoryDropdownItem[]> => {
  try {
    const params: { o: string; fav_only?: boolean } = {
      o: order,
    };
    if (favOnly) params.fav_only = true;
    const res = await api.get<CountryItem[]>("/myapi/territory2/", { params });
    if (!favOnly) cacheCountries(res.data);
    return res.data.map((item) => ({
      value: item.territory_id,
      label: item.name,
      code: item.code,
      icon: isoToFlagEmoji(item.code),
      iconLabelRight: item.favourite ? ("flag" as const) : undefined,
    }));
  } catch (e) {
    if (!favOnly) {
      const cached = getCachedCountries(order);
      if (cached.length > 0) return cached;
    }
    throw e;
  }
};

export const fetchMyPlaces = async (
  territory: number | null = null,
  coords: Coords | null = null,
  order: string,
): Promise<PlaceDropdownItem[]> => {
  if (!territory) return [];

  const cacheKey = `places|${territory}|${order}`;

  try {
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

    const items = res.data.map((item) => ({
      value: item.id,
      label: item.name,
      iconLabel: item.favourite ? ("star" as const) : undefined,
      location: item.location,
      distance: item.distance ?? undefined,
      preview: item.preview ?? undefined,
    }));
    cacheListResponse(placesDropdownCacheTable, cacheKey, items, MAX_ENTRIES);
    return placeRepository.applyDropdownOverlay(items, territory);
  } catch (e) {
    const cached = getCachedListResponse<PlaceDropdownItem[]>(
      placesDropdownCacheTable,
      cacheKey,
    );
    if (cached) return placeRepository.applyDropdownOverlay(cached, territory);

    // Nothing cached either: still worth showing a place created offline in
    // this territory (better than an error screen hiding it), but if there's
    // truly nothing — no cache, no pending place — keep surfacing the error
    // like before rather than silently showing an empty picker.
    const overlayOnly = placeRepository.applyDropdownOverlay([], territory);
    if (overlayOnly.length > 0) return overlayOnly;
    throw e;
  }
};

export const fetchSpecies = async (
  territory: number | null = null,
  order: string,
  dateFilter?: DateFilter,
): Promise<SpeciesDropdownItem[]> => {
  if (!territory) return [];

  const cacheKey = `species|${territory}|${order}|${stableStringify(dateFilter ?? {})}`;

  try {
    const params = {
      territory,
      per_page: 2500,
      o: order,
      ...buildDateParams(dateFilter),
    };
    const res = await api.get<PaginatedResponse<SpeciesItem>>(
      "/myapi/stat2/",
      { params },
    );

    const items = res.data?.results.map((item) => ({
      value: item.species_id,
      label: item.sp_name,
      name: item.sp_latin,
      name_lang: item.sp_name_lang,
      thumb: item.sp_thumb ?? undefined,
      seen: item.seen,
      segment: item.segment,
    }));
    cacheListResponse(speciesDropdownCacheTable, cacheKey, items, MAX_ENTRIES);
    return items;
  } catch (e) {
    const cached = getCachedListResponse<SpeciesDropdownItem[]>(
      speciesDropdownCacheTable,
      cacheKey,
    );
    if (cached) return cached;
    throw e;
  }
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

export const fetchMyProfile = async () => {
  const res = await api.get("/myapi/profile/me/");
  return res.data;
};

export const updateMyProfile = async (updatedData: Partial<Profile>) => {
  const res = await api.put("/myapi/profile/me/", updatedData);
  return res.data;
};

export const deleteMyProfile = async (
  userEmail: string,
): Promise<number | undefined> => {
  const res = await api.delete("/myapi/profile/delete-me/", {
    data: { email: userEmail },
  });
  return res?.status;
};

export const patchAvatar = async (
  image: ImageAsset,
): Promise<AvatarResponse> => {
  const formData = new FormData();

  formData.append("avatar", {
    uri: image.uri,
    name: "avatar.jpg",
    type: "image/jpeg",
  } as unknown as Blob);

  return (
    await api.patch<AvatarResponse>("/myapi/profile/avatar/", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    })
  ).data;
};

export const deleteMyAvatar = async (): Promise<number | undefined> => {
  const res = await api.delete("/myapi/profile/avatar/");
  return res?.status;
};

export const sendConfirmEmail = (key: string) =>
  api.post("/myapi/confirm/email/", { key });

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

const buildListCacheKeyPrefix = (
  fetchUrl: string,
  filters: Filters,
  search: string,
  page: number,
  extraParams: Record<string, unknown>,
) =>
  `${fetchUrl}|${i18n.language}|${stableStringify({ ...filters, ...extraParams })}|${search}|${page}|`;

const buildListCacheKey = (
  fetchUrl: string,
  filters: Filters,
  order: string | null,
  search: string,
  page: number,
  extraParams: Record<string, unknown>,
) =>
  `${buildListCacheKeyPrefix(fetchUrl, filters, search, page, extraParams)}order:${order ?? ""}`;

interface FetchAbstractOptions<T> {
  // Which dedicated cache table (see the cacheTable factory in
  // services/db/schema.ts) this fetch's responses are stored in, and how many
  // distinct queries it's allowed to keep — required so every caller makes an
  // explicit choice instead of silently sharing one generic pool.
  table: CacheTable;
  maxEntries: number;
  // Applied only to data served from the offline cache (fresh network
  // responses are already sorted server-side) — lets a screen recover the
  // sort the user actually asked for when the cache only has a differently
  // ordered entry for the same filters/search/page.
  resort?: (data: T, order: string | null) => T;
  // Called only if neither the exact nor the order-relaxed cache lookup
  // found anything, so a screen can derive a response from a related cache
  // entry (e.g. slicing an "all" list down to a seen/unseen subset).
  deriveFallback?: () => T | null;
}

const fetchAbstract = async <T>(
  fetchUrl: string,
  filters: Filters = {},
  order: string | null,
  search = "",
  page = 1,
  extraParams: Record<string, unknown> = {},
  perPage: number | undefined,
  options: FetchAbstractOptions<T>,
  // Sent to the API alongside extraParams, but deliberately left out of the
  // cache key: unlike extraParams (which changes what's actually being
  // asked for, e.g. a seen/unseen tab), this is for values that refine a
  // response the cache can still reuse as-is (currently just Places'
  // lng/lat for distance sort). Keeping them out of the key means an
  // offline read isn't required to have had the exact same coordinates as
  // whichever online fetch originally populated the cache — e.g. opening
  // the app offline before a GPS fix ever resolves this session would
  // otherwise cache-miss even though a perfectly good list from an earlier
  // session (fetched with different, or no, coordinates) is sitting right
  // there.
  requestOnlyParams: Record<string, unknown> = {},
): Promise<T> => {
  const cacheKey = buildListCacheKey(
    fetchUrl,
    filters,
    order,
    search,
    page,
    extraParams,
  );

  try {
    const { date, ...restFilters } = filters;

    const apiFilters = {
      ...restFilters,
      ...buildDateParams(date),
    };

    const params: Record<string, unknown> = {
      ...cleanFilters(apiFilters),
      ...extraParams,
      ...requestOnlyParams,
      per_page: perPage ?? 100,
      o: order,
    };
    if (search) params.name = search;
    if (page > 1) params.page = page;

    const res = await api.get<T>(fetchUrl, { params });
    cacheListResponse(options.table, cacheKey, res.data, options.maxEntries);
    return res.data;
  } catch (e) {
    const exactMatch = getCachedListResponse<T>(options.table, cacheKey);
    if (exactMatch) return exactMatch;

    // Same screen/filters/search/page, but cached under a different sort —
    // still useful offline even if the order doesn't match what was requested.
    const relaxedMatch = getCachedListResponseByPrefix<T>(
      options.table,
      buildListCacheKeyPrefix(fetchUrl, filters, search, page, extraParams),
    );
    if (relaxedMatch) {
      return options.resort ? options.resort(relaxedMatch, order) : relaxedMatch;
    }

    const derived = options.deriveFallback?.() ?? null;
    if (derived) {
      return options.resort ? options.resort(derived, order) : derived;
    }

    throw e;
  }
};

// Client-side re-sort used only as an offline fallback (see FetchAbstractOptions.resort
// above). Mirrors the `o=` ordering strings from sortOptionsList("Stat") — comma-separated
// fields, each optionally prefixed with "-" for descending, same as the backend accepts.
const speciesSortValue = (
  item: SpeciesItem,
  field: string,
): string | number | null => {
  switch (field) {
    case "name":
      return item.sp_name_lang ?? "";
    case "ioc_id":
      return item.ioc_id ?? null;
    case "seen":
      return item.seen ? 1 : 0;
    case "date_time":
      return item.max_date ?? item.min_date ?? null;
    default:
      return null;
  }
};

const compareSortValues = (a: string | number | null, b: string | number | null) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "string" && typeof b === "string") return a.localeCompare(b);
  return (a as number) - (b as number);
};

export const sortSpeciesItems = <T extends SpeciesItem>(
  items: T[],
  order: string | null,
): T[] => {
  if (!order) return items;

  const tokens = order.split(",").map((token) => ({
    field: token.replace(/^-/, ""),
    desc: token.startsWith("-"),
  }));

  // "ioc_id" isn't in the API response (only used server-side for ordering),
  // so we can't reproduce taxonomic order offline until the backend adds it —
  // leave the cached order untouched rather than guess.
  const canSort = tokens.every(
    (t) => t.field !== "ioc_id" || items.every((i) => typeof i.ioc_id === "number"),
  );
  if (!canSort) return items;

  return [...items].sort((a, b) => {
    for (const { field, desc } of tokens) {
      const cmp = compareSortValues(
        speciesSortValue(a, field),
        speciesSortValue(b, field),
      );
      if (cmp !== 0) return desc ? -cmp : cmp;
    }
    return 0;
  });
};

export const fetchStat = (
  filters: Filters,
  order: string | null = "name",
  search: string,
  page?: number,
) => {
  filters = { ...filters };
  const targetSeen = filters.seen ?? null;

  return fetchAbstract<StatPaginatedResponse<SpeciesItem>>(
    "/myapi/stat2/",
    filters,
    order,
    search,
    page,
    {},
    undefined,
    {
      table: statCacheTable,
      maxEntries: MAX_ENTRIES,
      resort: (data, ord) => ({
        ...data,
        results: sortSpeciesItems(data.results, ord),
      }),
      // Offline and this exact seen/unseen tab was never cached: derive it
      // from the "all" tab's cache instead of showing an error, since every
      // item already carries the `seen` flag needed to split it back out.
      deriveFallback:
        targetSeen === null
          ? undefined
          : () => {
              const allPrefix = buildListCacheKeyPrefix(
                "/myapi/stat2/",
                { ...filters, seen: null },
                search ?? "",
                page ?? 1,
                {},
              );
              const allData = getCachedListResponseByPrefix<
                StatPaginatedResponse<SpeciesItem>
              >(statCacheTable, allPrefix);
              if (!allData) return null;

              const results = allData.results.filter(
                (item) => item.seen === targetSeen,
              );
              return {
                ...allData,
                results,
                pagination: { ...allData.pagination, count: results.length },
              };
            },
    },
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
    {},
    undefined,
    { table: checklistCacheTable, maxEntries: MAX_ENTRIES },
  );
};

export const fetchPlaces = async (
  filters: Filters,
  order: string | null = "distance",
  search?: string,
  page?: number,
  coords?: Coords | null,
) => {
  const isDistanceSort = order === "distance" || order === "-distance";
  // Coordinates go in requestOnlyParams, not the cache key: whether they're
  // present/what they are shouldn't determine whether a cached list counts
  // as a hit — see fetchAbstract's comment on requestOnlyParams. Distance
  // *values* in an offline-served list may be stale/off, same tradeoff the
  // app already accepts elsewhere (e.g. fetchStat re-sorting cached data).
  const requestOnlyParams =
    isDistanceSort && coords ? { lng: coords[0], lat: coords[1] } : {};
  const data = await fetchAbstract<PaginatedResponse<PlaceItem>>(
    "/myapi/place2/",
    filters,
    order,
    search,
    page,
    {},
    undefined,
    { table: placesListCacheTable, maxEntries: MAX_ENTRIES },
    requestOnlyParams,
  );

  return placeRepository.applyOverlay(data, page ?? 1);
};

export const fetchObservations = async (
  filters: Filters,
  order: string | null = "species_name",
  search?: string,
  page?: number,
): Promise<PaginatedResponse<ObservationItem>> => {
  // No fallback to a synthetic empty response here: if there's truly nothing
  // cached for this exact query, we have no way to tell "you have zero
  // observations" apart from "this view was never cached" — showing an empty
  // list plus just the pending item would look like the rest of the data
  // disappeared. Let the normal offline error surface instead; the pending
  // item is still safe locally and reachable from its own detail screen.
  const data = await fetchAbstract<PaginatedResponse<ObservationItem>>(
    "/myapi/observation2/",
    filters,
    order,
    search,
    page,
    {},
    undefined,
    { table: observationsListCacheTable, maxEntries: MAX_ENTRIES },
  );

  return observationRepository.applyOverlay(data, page ?? 1);
};

export const fetchDiaries = async (
  filters: Filters,
  order: string | null = "-date_time",
  search?: string,
  page?: number,
) => {
  const data = await fetchAbstract<PaginatedResponse<DiaryListItem>>(
    "/myapi/diary2/",
    filters,
    order,
    search,
    page,
    {},
    undefined,
    {
      table: diariesListCacheTable,
      maxEntries: MAX_ENTRIES,
      // Offline with nothing cached yet for this exact query (e.g. the very
      // first load of the Diaries screen while offline): if there's a locally
      // pending diary create/update/delete, applyOverlay below still has
      // something to show, so hand it an empty base instead of letting the
      // error hide that pending diary. If there's no pending change either,
      // fall through to the normal offline error (nothing we could show).
      deriveFallback: () => {
        const overlay = diaryRepository.getOverlay();
        const hasOverlay =
          overlay.pendingCreates.length > 0 ||
          overlay.patchesById.size > 0 ||
          overlay.deletedIds.size > 0;
        return hasOverlay ? emptyPaginatedResponse<DiaryListItem>() : null;
      },
    },
  );

  return diaryRepository.applyOverlay(data, page ?? 1);
};

export const fetchDiaryObservations = async (
  filters: Filters,
  order: string | null = "-created_at",
  search?: string,
  page?: number,
) => {
  const data = await fetchAbstract<PaginatedResponse<DiaryObservationItem>>(
    "/myapi/diary-observation2/",
    filters,
    order,
    search,
    page,
    {},
    undefined,
    {
      table: diaryObservationsListCacheTable,
      maxEntries: MAX_ENTRIES,
      // Offline with nothing cached for this exact query: only safe to show
      // "no observations" instead of erroring when we actually know that's
      // true. A diary with a temp (negative) id only exists locally and was
      // never synced, so it provably has zero observations server-side.  A
      // real diary id's local row (see diaryRepository.cacheKnownSnapshot,
      // written the moment this diary's detail screen opens from a list card)
      // carries the last-known observation_count from the list — trust that
      // when it's exactly zero. Anything else (no local row, or a nonzero
      // count we can't produce the actual items for) keeps the normal offline
      // error rather than risk showing an empty list that contradicts a diary
      // card the user just saw with thumbnails on it.
      deriveFallback: () => {
        if (filters.diary == null) return null;
        const local = diaryRepository.getDiary(filters.diary);
        return local?.observation_count === 0
          ? emptyPaginatedResponse<DiaryObservationItem>()
          : null;
      },
    },
  );

  return observationRepository.applyDiaryOverlay(data, filters.diary, page ?? 1);
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
    {},
    undefined,
    { table: ratingCacheTable, maxEntries: MAX_ENTRIES },
  );
};

export const fetchRatingCompareHeader = async (
  profile1: number,
  profile2: number,
  filters: Filters | null,
) => {
  const cacheKey = `ratingCompareHeader|${profile1}|${profile2}|${stableStringify((filters ?? {}) as Record<string, unknown>)}`;

  try {
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
    cacheListResponse(ratingCompareHeaderCacheTable, cacheKey, res.data, MAX_ENTRIES);
    return res.data;
  } catch (e) {
    const cached = getCachedListResponse(ratingCompareHeaderCacheTable, cacheKey);
    if (cached) return cached;
    throw e;
  }
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
    {},
    undefined,
    { table: ratingCompareCacheTable, maxEntries: MAX_ENTRIES },
  );
};

export const fetchCommunityObservations = (
  filters: Filters,
  order: string | null = "species_name",
  search?: string,
  page?: number,
  coords?: Coords | null,
  per_page?: number,
) => {
  // Coords go in requestOnlyParams, not the cache key (see fetchPlaces'
  // identical comment on requestOnlyParams above): otherwise a list cached
  // while online under one GPS fix cache-misses entirely once offline with a
  // slightly different (or no) fix, even though nothing else about the query
  // changed — exactly what happened reopening the app in airplane mode.
  const requestOnlyParams = coords ? { lng: coords[0], lat: coords[1] } : {};

  return fetchAbstract<PaginatedResponse<ObservationItem>>(
    "/myapi/community2/",
    filters,
    order,
    search,
    page,
    {},
    per_page,
    { table: communityObservationsCacheTable, maxEntries: MAX_ENTRIES },
    requestOnlyParams,
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
  const res = await api.get("/myapi/notifications/unread-count/");
  return res.data.count;
};

export const markNotificationsRead = async (ids?: number[]): Promise<void> => {
  const body = ids ? { ids } : { all: true };
  await api.post("/myapi/notifications/read/", body);
};

export const registerPushToken = async (token: string): Promise<void> => {
  await api.post("/myapi/push-token/", {
    token,
    platform: Platform.OS, // 'ios' | 'android'
  });
};

export const unregisterPushToken = async (token: string): Promise<void> => {
  await api.delete(`/myapi/push-token/${encodeURIComponent(token)}/`);
};

export const reverseGeocoding = async (
  latitude: number,
  longitude: number,
): Promise<ReverseGeocode> => {
  const res = await api.get("/myapi/geocoding/reverse/", {
    params: {
      latitude,
      longitude,
    },
  });

  return res.data;
};
