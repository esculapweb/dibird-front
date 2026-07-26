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
import * as notificationRepository from "../hooks/repositories/notificationRepository";
import { isConnected } from "../services/sync/networkStatus";
import { runNotificationSync } from "../services/sync/notificationSync";
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
  notificationsListCacheTable,
  notificationUnreadCountCacheTable,
  staticPageCacheTable,
  dashboardStatCacheTable,
  activityCacheTable,
  birdOfDayCacheTable,
  userProfileCacheTable,
  mapPreviewCacheTable,
  diarySpeciesIdsCacheTable,
  taxonListCacheTable,
  taxonDetailCacheTable,
  territoryListCacheTable,
  territoryDetailCacheTable,
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
  AppError,
  TaxonRank,
  TaxonListItem,
  TaxonTraitFilters,
  TraitFilterOptions,
  TaxonGroupDetail,
  TaxonSpeciesDetail,
  TerritoryListItem,
  TerritoryRegionOption,
  TerritoryDetail,
  TerritoryCompareResponse,
  FetchFunction,
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
  const cacheKey = `page|${slug}|${i18n.language}`;

  try {
    const res = await api.get(`/api/page2/${slug}/`);
    const content = res.data?.content;
    cacheListResponse(staticPageCacheTable, cacheKey, content, MAX_ENTRIES);
    return content;
  } catch (e) {
    const cached = getCachedListResponse<string>(staticPageCacheTable, cacheKey);
    if (cached) return cached;
    throw e;
  }
};

// Taxonomy catalog (order -> family -> genus -> species), backed by
// /api/taxon/. A screen browsing one rank binds `rank` (and, when drilling
// into a parent's children, `parent`) up front via this factory — the
// returned function then matches FetchFunction<T> so it can go straight into
// useList, same as fetchPlaces/fetchObservations.
export const fetchTaxonList = (
  rank: TaxonRank,
  parent?: { segment: string; rank: TaxonRank } | null,
  extinct?: boolean,
  traits?: TaxonTraitFilters | null,
): FetchFunction<TaxonListItem> => {
  return (_filters, order, search, page) =>
    fetchAbstract<PaginatedResponse<TaxonListItem>>(
      "/api/taxon/",
      {},
      order ?? "name",
      search,
      page,
      {
        rank,
        ...(parent && { parent: parent.segment, parent_rank: parent.rank }),
        ...(extinct && { extinct: true }),
        ...traitParams(traits),
      },
      100,
      { table: taxonListCacheTable, maxEntries: MAX_ENTRIES },
    );
};

// Trait filters go in extraParams (they change what is being asked for, so
// they belong in the cache key); the multi-selects travel comma-separated.
const traitParams = (traits?: TaxonTraitFilters | null) => {
  const params: Record<string, string | number> = {};
  if (!traits) return params;

  for (const [key, value] of Object.entries(traits)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      if (value.length > 0) params[key] = value.join(",");
    } else {
      params[key] = value;
    }
  }
  return params;
};

// Just the total for the catalogue card — per_page=1 so the server counts
// without sending a page of species.
export const fetchSpeciesCount = async (): Promise<number> => {
  const res = await api.get<PaginatedResponse<TaxonListItem>>("/api/taxon/", {
    params: { rank: 5, per_page: 1 },
  });
  return res.data.pagination.count;
};

export const fetchTraitFilters = async (): Promise<TraitFilterOptions> => {
  const cacheKey = `trait-filters|${i18n.language}`;

  try {
    const res = await api.get<TraitFilterOptions>("/api/trait-filters/");
    cacheListResponse(taxonDetailCacheTable, cacheKey, res.data, MAX_ENTRIES);
    return res.data;
  } catch (e) {
    const cached = getCachedListResponse<TraitFilterOptions>(
      taxonDetailCacheTable,
      cacheKey,
    );
    if (cached) return cached;
    throw e;
  }
};

export const fetchTaxonDetail = async <
  T extends TaxonGroupDetail | TaxonSpeciesDetail,
>(
  segment: string,
  rank: TaxonRank,
): Promise<T> => {
  const cacheKey = `taxon-detail|${segment}|${rank}|${i18n.language}`;

  try {
    const res = await api.get<T>(`/api/taxon/${segment}/`, {
      params: { rank },
    });
    cacheListResponse(taxonDetailCacheTable, cacheKey, res.data, MAX_ENTRIES);
    return res.data;
  } catch (e) {
    const cached = getCachedListResponse<T>(taxonDetailCacheTable, cacheKey);
    if (cached) return cached;
    throw e;
  }
};

// Resolves a species' segment from its numeric taxon id — needed only when a
// caller has just the id (push notifications carry speciesId, not a
// segment); every in-app link already has the segment and calls
// fetchTaxonDetail directly.
export const fetchTaxonSegmentById = async (
  taxonId: number,
): Promise<string> => {
  const res = await api.get<PaginatedResponse<TaxonListItem>>("/api/taxon/", {
    params: { rank: 5, taxon_id: taxonId, per_page: 1 },
  });
  const segment = res.data.results[0]?.segment;
  if (!segment) throw new Error(`Species not found for id ${taxonId}`);
  return segment;
};

// Countries and territories catalogue (/api/territory/). Same factory shape as
// fetchTaxonList so the result drops straight into useList; `name` search and
// `o` ordering are handled by fetchAbstract. `region` goes in extraParams — it
// changes what is being asked for, so it belongs in the cache key.
export const fetchTerritoryList = (
  region?: number | null,
): FetchFunction<TerritoryListItem> => {
  return (_filters, order, search, page) =>
    fetchAbstract<PaginatedResponse<TerritoryListItem>>(
      "/api/territory/",
      {},
      order ?? "name",
      search,
      page,
      { ...(region != null && { region }) },
      100,
      { table: territoryListCacheTable, maxEntries: MAX_ENTRIES },
    );
};

// Regions offered by the country list's filter. `has_territories` keeps
// continents out: countries hang off sub-regions, so /api/territory/?region=
// rejects a continent id outright (TerritoryFilterSet.region) — offering one
// would just 400.
export const fetchTerritoryRegions = async (): Promise<
  TerritoryRegionOption[]
> => {
  const cacheKey = `territory-regions|${i18n.language}`;

  try {
    const res = await api.get<[number, { label: string }][]>(
      "/api/region-list/",
      { params: { has_territories: 1 } },
    );
    const items = res.data.map(([id, { label }]) => ({ id, label }));
    cacheListResponse(territoryListCacheTable, cacheKey, items, MAX_ENTRIES);
    return items;
  } catch (e) {
    const cached = getCachedListResponse<TerritoryRegionOption[]>(
      territoryListCacheTable,
      cacheKey,
    );
    if (cached) return cached;
    throw e;
  }
};

// Just the total for the catalogue card / shortcut — per_page=1 so the server
// counts without sending a page of countries.
export const fetchTerritoryCount = async (): Promise<number> => {
  const res = await api.get<PaginatedResponse<TerritoryListItem>>(
    "/api/territory/",
    { params: { per_page: 1 } },
  );
  return res.data.pagination.count;
};

export const fetchTerritoryDetail = async (
  segment: string,
): Promise<TerritoryDetail> => {
  const cacheKey = `territory-detail|${segment}|${i18n.language}`;

  try {
    const res = await api.get<TerritoryDetail>(`/api/territory/${segment}/`);
    cacheListResponse(
      territoryDetailCacheTable,
      cacheKey,
      res.data,
      MAX_ENTRIES,
    );
    return res.data;
  } catch (e) {
    const cached = getCachedListResponse<TerritoryDetail>(
      territoryDetailCacheTable,
      cacheKey,
    );
    if (cached) return cached;
    throw e;
  }
};

export const fetchTerritoryCompare = async (
  segment1: string,
  segment2: string,
): Promise<TerritoryCompareResponse> => {
  const cacheKey = `territory-compare|${segment1}|${segment2}|${i18n.language}`;

  try {
    const res = await api.get<TerritoryCompareResponse>(
      "/api/territory-compare/",
      { params: { segment1, segment2 } },
    );
    cacheListResponse(
      territoryDetailCacheTable,
      cacheKey,
      res.data,
      MAX_ENTRIES,
    );
    return res.data;
  } catch (e) {
    const cached = getCachedListResponse<TerritoryCompareResponse>(
      territoryDetailCacheTable,
      cacheKey,
    );
    if (cached) return cached;
    throw e;
  }
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

    // Same territory, but cached under a different sort order — still useful
    // offline (e.g. the user just switched sort with no connection): reuse it
    // resorted client-side rather than surfacing an error.
    const relaxed = getCachedListResponseByPrefix<PlaceDropdownItem[]>(
      placesDropdownCacheTable,
      `places|${territory}|`,
    );
    if (relaxed) {
      return placeRepository.applyDropdownOverlay(
        resortPlaceItems(relaxed, order),
        territory,
      );
    }

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

  // Order is kept last so a prefix match (territory + date filter, any order)
  // can be done offline below without it — see the catch block.
  const cacheKey = `species|${territory}|${stableStringify(dateFilter ?? {})}|${order}`;

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
      ioc_id: item.ioc_id,
    }));
    cacheListResponse(speciesDropdownCacheTable, cacheKey, items, MAX_ENTRIES);
    return items;
  } catch (e) {
    const cached = getCachedListResponse<SpeciesDropdownItem[]>(
      speciesDropdownCacheTable,
      cacheKey,
    );
    if (cached) return cached;

    // Same territory/date filter, but cached under a different sort order —
    // still useful offline (e.g. the user just switched sort with no
    // connection): reuse it resorted client-side rather than surfacing an error.
    const relaxed = getCachedListResponseByPrefix<SpeciesDropdownItem[]>(
      speciesDropdownCacheTable,
      `species|${territory}|${stableStringify(dateFilter ?? {})}|`,
    );
    if (relaxed) return resortSpeciesDropdownItems(relaxed, order);

    throw e;
  }
};

export const fetchDiarySpeciesIds = async (diaryId: number) => {
  const cacheKey = `diary-species-ids|${diaryId}`;

  try {
    const params = {
      diary: diaryId,
    };
    const res = await api.get("/myapi/diary-observation2/species-ids/", {
      params,
    });
    cacheListResponse(diarySpeciesIdsCacheTable, cacheKey, res.data, MAX_ENTRIES);
    return res.data;
  } catch (e) {
    const cached = getCachedListResponse(diarySpeciesIdsCacheTable, cacheKey);
    if (cached) return cached;
    throw e;
  }
};

export const fetchMapPreview = async (placeId: string | number | null) => {
  const cacheKey = `map-preview|${placeId}`;

  try {
    const res = await api.get(`/myapi/place2/${placeId}/map_preview/`);
    cacheListResponse(mapPreviewCacheTable, cacheKey, res.data, MAX_ENTRIES);
    return res.data;
  } catch (e) {
    const cached = getCachedListResponse(mapPreviewCacheTable, cacheKey);
    if (cached) return cached;
    throw e;
  }
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
  const cacheKey = `user-profile|${profileId}`;

  try {
    const res = await api.get(`/myapi/user-profile/${profileId}/`);
    cacheListResponse(userProfileCacheTable, cacheKey, res.data, MAX_ENTRIES);
    return res.data;
  } catch (e) {
    const cached = getCachedListResponse(userProfileCacheTable, cacheKey);
    if (cached) return cached;
    throw e;
  }
};

export const fetchMyActivity = async (filters: Filters) => {
  const cacheKey = `activity|${filters?.territory}|${stableStringify(filters?.date ?? {})}|${!!filters?.new}`;

  try {
    const params = {
      territory: filters?.territory,
      ...buildDateParams(filters?.date),
      ...(filters?.new && { new: true }),
    };

    const res = await api.get<ActivityResponse>(
      "/myapi/observation2/activity/",
      { params },
    );
    cacheListResponse(activityCacheTable, cacheKey, res.data, MAX_ENTRIES);
    return res.data;
  } catch (e) {
    const cached = getCachedListResponse<ActivityResponse>(
      activityCacheTable,
      cacheKey,
    );
    if (cached) return cached;
    throw e;
  }
};

export const fetchMyDashboardStat = async (filters: Filters) => {
  const cacheKey = `dashboard-stat|${filters?.territory}|${stableStringify(filters?.date ?? {})}`;

  try {
    const params = {
      territory: filters?.territory,
      ...buildDateParams(filters?.date),
    };

    const res = await api.get("/myapi/dashboard-stats2/", { params });
    cacheListResponse(dashboardStatCacheTable, cacheKey, res.data, MAX_ENTRIES);
    return res.data;
  } catch (e) {
    const cached = getCachedListResponse(dashboardStatCacheTable, cacheKey);
    if (cached) return cached;
    throw e;
  }
};

export const fetchBirdOfDay = async (territory: number | null) => {
  const cacheKey = `bird-of-day|${territory}|${i18n.language}`;

  try {
    const params = {
      territory: territory,
    };

    const res = await api.get<BirdOfTheDayType>(
      "/myapi/bird-of-day2/today/",
      { params },
    );
    cacheListResponse(birdOfDayCacheTable, cacheKey, res.data, MAX_ENTRIES);
    return res.data;
  } catch (e) {
    const cached = getCachedListResponse<BirdOfTheDayType>(
      birdOfDayCacheTable,
      cacheKey,
    );
    if (cached) return cached;
    throw e;
  }
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

// The checklist laid out as a plain list sorts in the app: /myapi/checklist2/
// answers in taxonomic order, unpaginated, so "ioc_id" is simply the order it
// arrived in (and its reverse) — there is no ioc id on the rows to sort by.
export const sortChecklistSpecies = (
  items: ChecklistItem[],
  order: string | null,
): ChecklistItem[] => {
  if (order === "name" || order === "-name") {
    const sorted = [...items].sort((a, b) =>
      (a.name_lang ?? "").localeCompare(b.name_lang ?? "", i18n.language),
    );
    return order === "-name" ? sorted.reverse() : sorted;
  }
  return order === "-ioc_id" ? [...items].reverse() : items;
};

// Same idea as sortSpeciesItems, for the Places dropdown's offline fallback
// (see fetchMyPlaces). "distance" is only resortable when every cached item
// actually carries a numeric distance — the backend only computes it when the
// original request itself was a distance-sorted fetch with live coords (see
// fetchMyPlaces' isDistanceSort/coords handling), so a cache entry written
// under e.g. "name" won't have it. When it's missing, flipping asc/desc can't
// be reproduced offline and the cached order is left as-is.
const placeSortValue = (
  item: PlaceDropdownItem,
  field: string,
): string | number | null => {
  switch (field) {
    case "name":
      return item.label ?? "";
    case "favourite":
      return item.iconLabel === "star" ? 1 : 0;
    case "distance":
      return typeof item.distance === "number" ? item.distance : null;
    default:
      return null;
  }
};

export const resortPlaceItems = <T extends PlaceDropdownItem>(
  items: T[],
  order: string | null,
): T[] => {
  if (!order) return items;

  const tokens = order.split(",").map((token) => ({
    field: token.replace(/^-/, ""),
    desc: token.startsWith("-"),
  }));

  const canSort = tokens.every(
    (t) =>
      t.field === "name" ||
      t.field === "favourite" ||
      (t.field === "distance" &&
        items.every((i) => typeof i.distance === "number")),
  );
  if (!canSort) return items;

  return [...items].sort((a, b) => {
    for (const { field, desc } of tokens) {
      const cmp = compareSortValues(
        placeSortValue(a, field),
        placeSortValue(b, field),
      );
      if (cmp !== 0) return desc ? -cmp : cmp;
    }
    return 0;
  });
};

// Same idea again, for the Species dropdown's offline fallback (see
// fetchSpecies). SpeciesDropdownItem is a different, slimmer shape than
// SpeciesItem, but it does carry `ioc_id` (populated from the same API field
// as SpeciesItem.ioc_id, see fetchSpecies above), so — like sortSpeciesItems —
// an "ioc_id" order can be reproduced offline as long as every cached item
// actually has it (older cache entries written before ioc_id was added here
// won't, so that's checked per-call rather than assumed).
const speciesDropdownSortValue = (
  item: SpeciesDropdownItem,
  field: string,
): string | number | null => {
  switch (field) {
    case "name":
      return item.name_lang ?? item.label ?? "";
    case "seen":
      return item.seen ? 1 : 0;
    case "ioc_id":
      return item.ioc_id ?? null;
    default:
      return null;
  }
};

export const resortSpeciesDropdownItems = <T extends SpeciesDropdownItem>(
  items: T[],
  order: string | null,
): T[] => {
  if (!order) return items;

  const tokens = order.split(",").map((token) => ({
    field: token.replace(/^-/, ""),
    desc: token.startsWith("-"),
  }));

  const canSort = tokens.every(
    (t) =>
      t.field === "name" ||
      t.field === "seen" ||
      (t.field === "ioc_id" &&
        items.every((i) => typeof i.ioc_id === "number")),
  );
  if (!canSort) return items;

  return [...items].sort((a, b) => {
    for (const { field, desc } of tokens) {
      const cmp = compareSortValues(
        speciesDropdownSortValue(a, field),
        speciesDropdownSortValue(b, field),
      );
      if (cmp !== 0) return desc ? -cmp : cmp;
    }
    return 0;
  });
};

// Same idea again, for the main Places list's offline fallback (fetchPlaces
// below) — distinct from resortPlaceItems above, which is for the
// PlaceDropdownItem picker and doesn't carry species_count/observation_count.
const placeListSortValue = (
  item: PlaceItem,
  field: string,
): string | number | null => {
  switch (field) {
    case "name":
      return item.name ?? "";
    case "favourite":
      return item.favourite ? 1 : 0;
    case "distance":
      return typeof item.distance === "number" ? item.distance : null;
    case "species_count":
      return item.species_count ?? 0;
    case "observation_count":
      return item.observation_count ?? 0;
    default:
      return null;
  }
};

export const resortPlaceListItems = <T extends PlaceItem>(
  items: T[],
  order: string | null,
): T[] => {
  if (!order) return items;

  const tokens = order.split(",").map((token) => ({
    field: token.replace(/^-/, ""),
    desc: token.startsWith("-"),
  }));

  const canSort = tokens.every(
    (t) =>
      t.field === "name" ||
      t.field === "favourite" ||
      t.field === "species_count" ||
      t.field === "observation_count" ||
      (t.field === "distance" &&
        items.every((i) => typeof i.distance === "number")),
  );
  if (!canSort) return items;

  return [...items].sort((a, b) => {
    for (const { field, desc } of tokens) {
      const cmp = compareSortValues(
        placeListSortValue(a, field),
        placeListSortValue(b, field),
      );
      if (cmp !== 0) return desc ? -cmp : cmp;
    }
    return 0;
  });
};

// For fetchObservations/fetchCommunityObservations's offline fallback.
// "species_name" and "ioc_id" are order strings the API accepts, but neither
// maps to a literal field on ObservationItem — name is nested under
// species_data.name_lang, and there's no ioc_id at all here (same gap as
// SpeciesItem/sortSpeciesItems), so "ioc_id" can't be reproduced offline and
// is left as an unsupported token below.
const observationSortValue = (
  item: ObservationItem,
  field: string,
): string | number | null => {
  switch (field) {
    case "species_name":
      return item.species_data?.name_lang ?? "";
    case "date_time":
      return item.date_time ?? null;
    case "distance":
      return typeof item.distance === "number" ? item.distance : null;
    default:
      return null;
  }
};

export const resortObservationItems = <T extends ObservationItem>(
  items: T[],
  order: string | null,
): T[] => {
  if (!order) return items;

  const tokens = order.split(",").map((token) => ({
    field: token.replace(/^-/, ""),
    desc: token.startsWith("-"),
  }));

  const canSort = tokens.every(
    (t) =>
      t.field === "species_name" ||
      t.field === "date_time" ||
      (t.field === "distance" &&
        items.every((i) => typeof i.distance === "number")),
  );
  if (!canSort) return items;

  return [...items].sort((a, b) => {
    for (const { field, desc } of tokens) {
      const cmp = compareSortValues(
        observationSortValue(a, field),
        observationSortValue(b, field),
      );
      if (cmp !== 0) return desc ? -cmp : cmp;
    }
    return 0;
  });
};

// For fetchDiaryObservations' offline fallback. DiaryObservationItem is a
// slimmer shape than ObservationItem (no date_time/ioc_id at all), so only
// "species_name" (via species_data.name_lang) and "created_at" are
// reproducible offline.
const diaryObservationSortValue = (
  item: DiaryObservationItem,
  field: string,
): string | number | null => {
  switch (field) {
    case "species_name":
      return item.species_data?.name_lang ?? "";
    case "created_at":
      return item.created_at ?? null;
    default:
      return null;
  }
};

export const resortDiaryObservationItems = <T extends DiaryObservationItem>(
  items: T[],
  order: string | null,
): T[] => {
  if (!order) return items;

  const tokens = order.split(",").map((token) => ({
    field: token.replace(/^-/, ""),
    desc: token.startsWith("-"),
  }));

  const canSort = tokens.every(
    (t) => t.field === "species_name" || t.field === "created_at",
  );
  if (!canSort) return items;

  return [...items].sort((a, b) => {
    for (const { field, desc } of tokens) {
      const cmp = compareSortValues(
        diaryObservationSortValue(a, field),
        diaryObservationSortValue(b, field),
      );
      if (cmp !== 0) return desc ? -cmp : cmp;
    }
    return 0;
  });
};

// For fetchDiaries' offline fallback. "name" here is the diary's own title
// (DiaryListItem.name), not a species name.
const diaryListSortValue = (
  item: DiaryListItem,
  field: string,
): string | number | null => {
  switch (field) {
    case "date_time":
      return item.date_time ?? null;
    case "observation_count":
      return item.observation_count ?? 0;
    case "name":
      return item.name ?? "";
    default:
      return null;
  }
};

export const resortDiaryListItems = <T extends DiaryListItem>(
  items: T[],
  order: string | null,
): T[] => {
  if (!order) return items;

  const tokens = order.split(",").map((token) => ({
    field: token.replace(/^-/, ""),
    desc: token.startsWith("-"),
  }));

  const canSort = tokens.every(
    (t) =>
      t.field === "date_time" ||
      t.field === "observation_count" ||
      t.field === "name",
  );
  if (!canSort) return items;

  return [...items].sort((a, b) => {
    for (const { field, desc } of tokens) {
      const cmp = compareSortValues(
        diaryListSortValue(a, field),
        diaryListSortValue(b, field),
      );
      if (cmp !== 0) return desc ? -cmp : cmp;
    }
    return 0;
  });
};

// For fetchRating's offline fallback.
const ratingSortValue = (
  item: RatingItem,
  field: string,
): string | number | null => {
  switch (field) {
    case "observations":
      return item.seen_qty ?? 0;
    case "last_update":
      return item.last_update ?? null;
    default:
      return null;
  }
};

export const resortRatingItems = <T extends RatingItem>(
  items: T[],
  order: string | null,
): T[] => {
  if (!order) return items;

  const tokens = order.split(",").map((token) => ({
    field: token.replace(/^-/, ""),
    desc: token.startsWith("-"),
  }));

  const canSort = tokens.every(
    (t) => t.field === "observations" || t.field === "last_update",
  );
  if (!canSort) return items;

  return [...items].sort((a, b) => {
    for (const { field, desc } of tokens) {
      const cmp = compareSortValues(
        ratingSortValue(a, field),
        ratingSortValue(b, field),
      );
      if (cmp !== 0) return desc ? -cmp : cmp;
    }
    return 0;
  });
};

// For fetchRatingCompare's offline fallback. The UI's "ioc_id" sort token
// maps to RatingCompareItem.taxon_id — a different field name, but (unlike
// SpeciesItem.ioc_id) always present and numeric, so it's always safe to sort
// by rather than needing a per-call "does every item have it" check.
const ratingCompareSortValue = (
  item: RatingCompareItem,
  field: string,
): string | number | null => {
  switch (field) {
    case "name":
      return item.name_lang ?? "";
    case "ioc_id":
      return item.taxon_id ?? null;
    default:
      return null;
  }
};

export const resortRatingCompareItems = <T extends RatingCompareItem>(
  items: T[],
  order: string | null,
): T[] => {
  if (!order) return items;

  const tokens = order.split(",").map((token) => ({
    field: token.replace(/^-/, ""),
    desc: token.startsWith("-"),
  }));

  const canSort = tokens.every((t) => t.field === "name" || t.field === "ioc_id");
  if (!canSort) return items;

  return [...items].sort((a, b) => {
    for (const { field, desc } of tokens) {
      const cmp = compareSortValues(
        ratingCompareSortValue(a, field),
        ratingCompareSortValue(b, field),
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

// Backs the client-only "unsynced" filter on fetchObservations/fetchDiaries/
// fetchPlaces below: that filter has no server-side meaning (it reflects
// this device's local mutation queue), so those fetches bypass the
// network/cache entirely and hand back just the local unsynced set instead
// of sending it as a query param. Everything is already loaded locally, so
// it's all returned as a single page — a page beyond the first has nothing
// left to add.
const buildLocalOnlyResponse = <T>(items: T[]): PaginatedResponse<T> => ({
  results: items,
  pagination: {
    count: items.length,
    per_page: Math.max(items.length, 1),
    current: 1,
    final: 1,
    next: null,
    previous: null,
  },
});

export const fetchPlaces = async (
  filters: Filters,
  order: string | null = "distance",
  search?: string,
  page?: number,
  coords?: Coords | null,
) => {
  if (filters.unsynced) {
    if ((page ?? 1) > 1) return emptyPaginatedResponse<PlaceItem>();
    const items = resortPlaceListItems(placeRepository.getUnsyncedItems(), order);
    return buildLocalOnlyResponse(items);
  }

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
    {
      table: placesListCacheTable,
      maxEntries: MAX_ENTRIES,
      resort: (data, ord) => ({
        ...data,
        results: resortPlaceListItems(data.results, ord),
      }),
      // Offline with nothing cached yet for this exact query (e.g. the very
      // first load of the Places screen while offline, right after signup):
      // if there's a locally pending place create/update/delete, applyOverlay
      // below still has something to show, so hand it an empty base instead
      // of letting the error hide it — same reasoning as fetchDiaries. Only
      // kicks in when the overlay is non-empty, so this never claims "zero
      // places" when the truth is merely "never cached".
      deriveFallback: () => {
        const overlay = placeRepository.getOverlay();
        const hasOverlay =
          overlay.pendingCreates.length > 0 ||
          overlay.patchesById.size > 0 ||
          overlay.deletedIds.size > 0;
        return hasOverlay ? emptyPaginatedResponse<PlaceItem>() : null;
      },
    },
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
  if (filters.unsynced) {
    if ((page ?? 1) > 1) return emptyPaginatedResponse<ObservationItem>();
    const items = resortObservationItems(
      observationRepository.getUnsyncedItems(),
      order,
    );
    return buildLocalOnlyResponse(items);
  }

  const data = await fetchAbstract<PaginatedResponse<ObservationItem>>(
    "/myapi/observation2/",
    filters,
    order,
    search,
    page,
    {},
    undefined,
    {
      table: observationsListCacheTable,
      maxEntries: MAX_ENTRIES,
      resort: (data, ord) => ({
        ...data,
        results: resortObservationItems(data.results, ord),
      }),
      // Offline with nothing cached yet for this exact query (e.g. the very
      // first load of the Observations screen while offline, right after
      // signup): same reasoning/tradeoff as fetchDiaries — a locally pending
      // create/update/delete is still shown via an empty base instead of
      // letting the error hide it. This only kicks in when the overlay is
      // non-empty, so it never claims "zero observations" when the truth is
      // merely "never cached" for this exact query. The remaining risk this
      // accepts (same one fetchDiaries already accepts): a user with many
      // already-synced observations cached under a *different* filter/sort/
      // page than the current one would see just the pending item here,
      // which could misleadingly read as "the rest of my data disappeared"
      // rather than "this specific view was never loaded."
      deriveFallback: () => {
        const overlay = observationRepository.getOverlay();
        const hasOverlay =
          overlay.pendingCreates.length > 0 ||
          overlay.patchesById.size > 0 ||
          overlay.deletedIds.size > 0;
        return hasOverlay ? emptyPaginatedResponse<ObservationItem>() : null;
      },
    },
  );

  return observationRepository.applyOverlay(data, page ?? 1);
};

export const fetchDiaries = async (
  filters: Filters,
  order: string | null = "-date_time",
  search?: string,
  page?: number,
) => {
  if (filters.unsynced) {
    if ((page ?? 1) > 1) return emptyPaginatedResponse<DiaryListItem>();
    const items = resortDiaryListItems(diaryRepository.getUnsyncedItems(), order);
    return buildLocalOnlyResponse(items);
  }

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
      resort: (data, ord) => ({
        ...data,
        results: resortDiaryListItems(data.results, ord),
      }),
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
      resort: (data, ord) => ({
        ...data,
        results: resortDiaryObservationItems(data.results, ord),
      }),
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
    {
      table: ratingCacheTable,
      maxEntries: MAX_ENTRIES,
      resort: (data, ord) => ({
        ...data,
        results: resortRatingItems(data.results, ord),
      }),
    },
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
    {
      table: ratingCompareCacheTable,
      maxEntries: MAX_ENTRIES,
      resort: (data, ord) => ({
        ...data,
        results: resortRatingCompareItems(data.results, ord),
      }),
    },
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
    {
      table: communityObservationsCacheTable,
      maxEntries: MAX_ENTRIES,
      resort: (data, ord) => ({
        ...data,
        results: resortObservationItems(data.results, ord),
      }),
    },
    requestOnlyParams,
  );
};


export const fetchNotifications = async (page = 1) => {
  const data = await fetchAbstract<PaginatedResponse<AppNotification>>(
    "/myapi/notifications/",
    {},
    "-created_at",
    "",
    page,
    {},
    undefined,
    { table: notificationsListCacheTable, maxEntries: MAX_ENTRIES },
  );
  return notificationRepository.applyOverlay(data);
};

const UNREAD_COUNT_CACHE_KEY = "unread_count";

export const fetchUnreadCount = async (): Promise<number> => {
  try {
    const res = await api.get("/myapi/notifications/unread-count/");
    const count = res.data.count as number;
    cacheListResponse(
      notificationUnreadCountCacheTable,
      UNREAD_COUNT_CACHE_KEY,
      { count },
      1,
    );
    return notificationRepository.applyPendingUnreadAdjustment(count);
  } catch (e) {
    const cached = getCachedListResponse<{ count: number }>(
      notificationUnreadCountCacheTable,
      UNREAD_COUNT_CACHE_KEY,
    );
    if (cached) return notificationRepository.applyPendingUnreadAdjustment(cached.count);
    throw e;
  }
};

export const markNotificationsRead = async (ids?: number[]): Promise<void> => {
  if (isConnected()) {
    try {
      const body = ids ? { ids } : { all: true };
      await api.post("/myapi/notifications/read/", body);
      return;
    } catch (e) {
      const error = e as AppError;
      if (!error.isNetworkError && !error.isTimeout) throw error;
    }
  }

  if (ids) notificationRepository.markIdsReadLocal(ids);
  else notificationRepository.markAllReadLocal();
  runNotificationSync();
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
