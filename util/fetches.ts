import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

import api from "../services/api";
import {
  isoToFlagEmoji,
  buildDateParams,
  cleanFilters,
  roundCoords,
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
import { cachedRead, assertNotGone } from "../services/cacheFallback";
import { runNotificationSync } from "../services/sync/notificationSync";
import {
  speciesDropdownCacheTable,
  placesDropdownCacheTable,
  statCacheTable,
  checklistCacheTable,
  placesListCacheTable,
  observationPlacesCacheTable,
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

// One page holding every place for the observations map (see
// fetchObservationPlaces). Sized to sit under the server's own per_page cap
// (CustomPagination.max_page_size); a user with more distinct places than this
// would lose the tail, which is far more places than an eBird import creates.
const MAP_PLACES_PER_PAGE = 2000;

// Points on a map have no meaningful order; this is here only because the
// cache key is built from it, so it has to be stable.
const MAP_PLACES_ORDER = "name";
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
  ObservationImport,
  ObservationPhoto,
  FetchFunction,
  AppUpdateKind,
  AppUpdateStage,
  BlockedUser,
  ReportReason,
  ReportTarget,
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

// axios is configured with a client-wide 10 s timeout (services/api.ts). That
// is a sane *read* timeout and a bad *upload* one: a request that is still
// sending its body gets cut off, and a premature timeout is indistinguishable
// from being offline — the offline-first layers then queue a retry of a
// request the server may well have received. Every multipart call below sets
// its own instead.
const UPLOAD_TIMEOUT_MS = 60000;
// The CSV import allows the largest file of anything here
// (OBS_IMPORT_MAX_BYTES on the backend), so it gets proportionally longer.
const IMPORT_UPLOAD_TIMEOUT_MS = 120000;

export const startObservationImport = async (
  file: { uri: string; name: string },
  makePublic: boolean,
): Promise<ObservationImport> => {
  const formData = new FormData();

  // The same shape as for the avatar (`patchAvatar`): RN's FormData accepts a file
  // object that does not exist in the web Blob type.
  formData.append("file", {
    uri: file.uri,
    name: file.name,
    type: "text/csv",
  } as unknown as Blob);
  formData.append("make_public", makePublic ? "true" : "false");

  return (
    await api.post<ObservationImport>("/myapi/observation-import/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: IMPORT_UPLOAD_TIMEOUT_MS,
    })
  ).data;
};

export const pollObservationImportStatus =
  async (): Promise<ObservationImport> => {
    const res = await api.get("/myapi/observation-import/status/");
    return res.data;
  };

export const fetchTimezones = () =>
  cachedRead(
    "fetchTimezones",
    () => {
      const cached = getCachedTimezones();
      return cached.length > 0 ? cached : null;
    },
    async () => {
      const res = await api.get<[string, string][]>("/api/timezones2/");
      const items = res.data.map(([value, label]) => ({
        value,
        label,
      }));
      cacheTimezones(items);
      return items;
    },
  );

export const fetchPage = (slug: string) => {
  const cacheKey = `page|${slug}|${i18n.language}`;

  return cachedRead(
    "fetchPage",
    () => getCachedListResponse<string>(staticPageCacheTable, cacheKey) ?? null,
    async () => {
      const res = await api.get(`/api/page2/${slug}/`);
      const content = res.data?.content;
      cacheListResponse(staticPageCacheTable, cacheKey, content, MAX_ENTRIES);
      return content;
    },
    assertNotGone,
  );
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

export const fetchTraitFilters = (): Promise<TraitFilterOptions> => {
  const cacheKey = `trait-filters|${i18n.language}`;

  return cachedRead(
    "fetchTraitFilters",
    () =>
      getCachedListResponse<TraitFilterOptions>(taxonDetailCacheTable, cacheKey) ??
      null,
    async () => {
      const res = await api.get<TraitFilterOptions>("/api/trait-filters/");
      cacheListResponse(taxonDetailCacheTable, cacheKey, res.data, MAX_ENTRIES);
      return res.data;
    },
  );
};

export const fetchTaxonDetail = <T extends TaxonGroupDetail | TaxonSpeciesDetail>(
  segment: string,
  rank: TaxonRank,
): Promise<T> => {
  const cacheKey = `taxon-detail|${segment}|${rank}|${i18n.language}`;

  return cachedRead(
    "fetchTaxonDetail",
    () => getCachedListResponse<T>(taxonDetailCacheTable, cacheKey) ?? null,
    async () => {
      const res = await api.get<T>(`/api/taxon/${segment}/`, {
        params: { rank },
      });
      cacheListResponse(taxonDetailCacheTable, cacheKey, res.data, MAX_ENTRIES);
      return res.data;
    },
    assertNotGone,
  );
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
export const fetchTerritoryRegions = (): Promise<TerritoryRegionOption[]> => {
  const cacheKey = `territory-regions|${i18n.language}`;

  return cachedRead(
    "fetchTerritoryRegions",
    () =>
      getCachedListResponse<TerritoryRegionOption[]>(
        territoryListCacheTable,
        cacheKey,
      ) ?? null,
    async () => {
      const res = await api.get<[number, { label: string }][]>(
        "/api/region-list/",
        { params: { has_territories: 1 } },
      );
      const items = res.data.map(([id, { label }]) => ({ id, label }));
      cacheListResponse(territoryListCacheTable, cacheKey, items, MAX_ENTRIES);
      return items;
    },
    assertNotGone,
  );
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

export const fetchTerritoryDetail = (
  segment: string,
): Promise<TerritoryDetail> => {
  const cacheKey = `territory-detail|${segment}|${i18n.language}`;

  return cachedRead(
    "fetchTerritoryDetail",
    () =>
      getCachedListResponse<TerritoryDetail>(
        territoryDetailCacheTable,
        cacheKey,
      ) ?? null,
    async () => {
      const res = await api.get<TerritoryDetail>(`/api/territory/${segment}/`);
      cacheListResponse(
        territoryDetailCacheTable,
        cacheKey,
        res.data,
        MAX_ENTRIES,
      );
      return res.data;
    },
    assertNotGone,
  );
};

// A row of the tree as the public /api/checklist/ returns it (TreeViewSet on the
// backend). Its field names are its own — this is the site's response, not the
// app's.
interface TerritoryTreeRow {
  depth: number;
  d_name: string;
  d_name_lang: string;
  d_segment: string;
  thumb: string | null;
  // The IUCN category ("LC", "VU", …).
  d_status: string | null;
  // The occurrence status on the territory (free-form text from Avibase) — in
  // /myapi/ this field is called occurrence. Present on species only.
  status?: string | null;
}

const TREE_DEPTH_TYPE: Record<number, ChecklistItem["type"]> = {
  2: "order",
  3: "family",
  4: "genus",
  5: "species",
};

// How deep a group is nested — in the same order as the search in
// components/Territory/TerritoryChecklist.tsx.
const GROUP_LEVEL: Record<string, number> = { order: 0, family: 1, genus: 2 };

/**
 * The birds of a country for the catalogue — from the public `/api/checklist/`
 * endpoint rather than the personal `/myapi/checklist2/`.
 *
 * Two reasons. The first: the country page is open to a guest, while `/myapi/`
 * requires an account. The second: for the sake of this page `checklist2` computed
 * `seen` with an Exists subquery on each of the ~1000-2000 rows, and the result
 * went nowhere — the personal layer on the country page is off
 * (`ChecklistCard.personal`).
 *
 * The key here is `id_avibase` rather than our `Territory.pk`: the public endpoint
 * has an identifier system of its own. The response arrives as a single page in
 * taxonomic order (a parent always precedes its descendants), so the number of
 * species in a group is counted in the same pass — the backend does not have it,
 * and the order and family rows need it.
 */
export const fetchTerritoryTree = (
  idAvibase: number,
): Promise<ChecklistItem[]> => {
  const cacheKey = `territory-tree|${idAvibase}|${i18n.language}`;

  const toItems = (rows: TerritoryTreeRow[]): ChecklistItem[] => {
    const items: ChecklistItem[] = rows.map((row) => ({
      latin: row.d_name,
      name_lang: row.d_name_lang,
      segment: row.d_segment,
      // There is no personal layer on the country page, but the field is required
      // by ChecklistItem — `personal={false}` does not read it anyway.
      seen: false,
      status: row.d_status ?? null,
      occurrence: row.status ?? null,
      thumb: row.thumb,
      type: TREE_DEPTH_TYPE[row.depth] ?? "species",
    }));

    // A stack of open groups by rank: a species is counted towards every group
    // above it, and a new group closes all groups of its own rank and deeper.
    const open: ChecklistItem[] = [];
    for (const item of items) {
      if (item.type === "species") {
        open.forEach((group) => (group.total = (group.total ?? 0) + 1));
        continue;
      }
      const level = GROUP_LEVEL[item.type] ?? 0;
      open.length = level;
      open[level] = item;
      item.total = 0;
    }

    return items;
  };

  return cachedRead(
    "fetchTerritoryTree",
    () =>
      getCachedListResponse<ChecklistItem[]>(
        territoryDetailCacheTable,
        cacheKey,
      ) ?? null,
    async () => {
      const res = await api.get<TerritoryTreeRow[]>("/api/checklist/", {
        params: { id: idAvibase },
      });
      const items = toItems(res.data);
      cacheListResponse(territoryDetailCacheTable, cacheKey, items, MAX_ENTRIES);
      return items;
    },
  );
};

export const fetchTerritoryCompare = (
  segment1: string,
  segment2: string,
): Promise<TerritoryCompareResponse> => {
  const cacheKey = `territory-compare|${segment1}|${segment2}|${i18n.language}`;

  return cachedRead(
    "fetchTerritoryCompare",
    () =>
      getCachedListResponse<TerritoryCompareResponse>(
        territoryDetailCacheTable,
        cacheKey,
      ) ?? null,
    async () => {
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
    },
    assertNotGone,
  );
};

export const fetchMyCountries = (
  favOnly = false,
  order: string,
): Promise<TerritoryDropdownItem[]> =>
  cachedRead(
    "fetchMyCountries",
    () => {
      // Only the full list is cached: the fav_only selection has no cache of its own.
      if (favOnly) return null;
      const cached = getCachedCountries(order);
      return cached.length > 0 ? cached : null;
    },
    async () => {
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
    },
  );

export const fetchMyPlaces = (
  territory: number | null = null,
  coords: Coords | null = null,
  order: string,
): Promise<PlaceDropdownItem[]> => {
  if (!territory) return Promise.resolve([]);

  const cacheKey = `places|${territory}|${order}`;

  return cachedRead(
    "fetchMyPlaces",
    () => {
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
      return overlayOnly.length > 0 ? overlayOnly : null;
    },
    async () => {
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
    },
  );
};

export const fetchSpecies = (
  territory: number | null = null,
  order: string,
  dateFilter?: DateFilter,
): Promise<SpeciesDropdownItem[]> => {
  if (!territory) return Promise.resolve([]);

  // Order is kept last so a prefix match (territory + date filter, any order)
  // can be done offline below without it — see readCache.
  const cacheKey = `species|${territory}|${stableStringify(dateFilter ?? {})}|${order}`;

  return cachedRead(
    "fetchSpecies",
    () => {
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

      return null;
    },
    async () => {
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
    },
  );
};

export const fetchDiarySpeciesIds = (diaryId: number) => {
  const cacheKey = `diary-species-ids|${diaryId}`;

  return cachedRead(
    "fetchDiarySpeciesIds",
    () => getCachedListResponse(diarySpeciesIdsCacheTable, cacheKey) ?? null,
    async () => {
      const params = {
        diary: diaryId,
      };
      const res = await api.get("/myapi/diary-observation2/species-ids/", {
        params,
      });
      cacheListResponse(
        diarySpeciesIdsCacheTable,
        cacheKey,
        res.data,
        MAX_ENTRIES,
      );
      return res.data;
    },
  );
};

export const fetchMapPreview = (placeId: string | number | null) => {
  const cacheKey = `map-preview|${placeId}`;

  return cachedRead(
    "fetchMapPreview",
    () => getCachedListResponse(mapPreviewCacheTable, cacheKey) ?? null,
    async () => {
      const res = await api.get(`/myapi/place2/${placeId}/map_preview/`);
      cacheListResponse(mapPreviewCacheTable, cacheKey, res.data, MAX_ENTRIES);
      return res.data;
    },
  );
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

const OBSERVATION_PHOTO_URL = "/myapi/observation-photo/";

export const uploadObservationPhoto = async (
  observationId: number,
  uri: string,
  sortOrder: number,
  clientRequestId: string,
): Promise<ObservationPhoto> => {
  const formData = new FormData();

  // The same shape as for the avatar (`patchAvatar`): RN's FormData accepts a
  // file object that does not exist in the web Blob type.
  formData.append("image", {
    uri,
    name: "photo.jpg",
    type: "image/jpeg",
  } as unknown as Blob);
  formData.append("observation", String(observationId));
  formData.append("sort_order", String(sortOrder));
  formData.append("client_request_id", clientRequestId);

  return (
    await api.post<ObservationPhoto>(OBSERVATION_PHOTO_URL, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: UPLOAD_TIMEOUT_MS,
    })
  ).data;
};

export const deleteObservationPhoto = (id: number) =>
  api.delete(`${OBSERVATION_PHOTO_URL}${id}/`);

// Moderation. Neither of these has an offline fallback on purpose: a report
// that only reached the local database would leave the user believing the
// content is gone while nobody has been told, and a block is what the feed's
// own queryset is filtered by — it has to reach the server to mean anything.
export const reportContent = async (
  target: ReportTarget,
  reason: ReportReason,
  comment?: string,
): Promise<void> => {
  await api.post("/myapi/reports/", {
    ...target,
    reason,
    ...(comment ? { comment } : {}),
  });
};

export const fetchBlockedUsers = async (): Promise<BlockedUser[]> => {
  const res = await api.get<PaginatedResponse<BlockedUser>>("/myapi/blocks/");
  return res.data.results;
};

export const blockUser = async (profileId: number): Promise<void> => {
  await api.post("/myapi/blocks/", { blocked: profileId });
};

// Addressed by profile id, not by the id of the block row: the screen that
// unblocks knows who, and the server's lookup_field matches (UserBlockViewSet).
export const unblockUser = async (profileId: number): Promise<void> => {
  await api.delete(`/myapi/blocks/${profileId}/`);
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
      timeout: UPLOAD_TIMEOUT_MS,
    })
  ).data;
};

export const deleteMyAvatar = async (): Promise<number | undefined> => {
  const res = await api.delete("/myapi/profile/avatar/");
  return res?.status;
};

export const sendConfirmEmail = (key: string) =>
  api.post("/myapi/confirm/email/", { key });

export const fetchUserProfile = (profileId: number) => {
  const cacheKey = `user-profile|${profileId}`;

  return cachedRead(
    "fetchUserProfile",
    () => getCachedListResponse(userProfileCacheTable, cacheKey) ?? null,
    async () => {
      const res = await api.get(`/myapi/user-profile/${profileId}/`);
      cacheListResponse(userProfileCacheTable, cacheKey, res.data, MAX_ENTRIES);
      return res.data;
    },
    assertNotGone,
  );
};

export const fetchMyActivity = (filters: Filters) => {
  const cacheKey = `activity|${filters?.territory}|${stableStringify(filters?.date ?? {})}|${!!filters?.new}`;

  return cachedRead(
    "fetchMyActivity",
    () =>
      getCachedListResponse<ActivityResponse>(activityCacheTable, cacheKey) ??
      null,
    async () => {
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
    },
  );
};

export const fetchMyDashboardStat = (filters: Filters) => {
  const cacheKey = `dashboard-stat|${filters?.territory}|${stableStringify(filters?.date ?? {})}`;

  return cachedRead(
    "fetchMyDashboardStat",
    () => getCachedListResponse(dashboardStatCacheTable, cacheKey) ?? null,
    async () => {
      const params = {
        territory: filters?.territory,
        ...buildDateParams(filters?.date),
      };

      const res = await api.get("/myapi/dashboard-stats2/", { params });
      cacheListResponse(dashboardStatCacheTable, cacheKey, res.data, MAX_ENTRIES);
      return res.data;
    },
  );
};

export const fetchBirdOfDay = (territory: number | null) => {
  const cacheKey = `bird-of-day|${territory}|${i18n.language}`;

  return cachedRead(
    "fetchBirdOfDay",
    () =>
      getCachedListResponse<BirdOfTheDayType>(birdOfDayCacheTable, cacheKey) ??
      null,
    async () => {
      const params = {
        territory: territory,
      };

      const res = await api.get<BirdOfTheDayType>(
        "/myapi/bird-of-day2/today/",
        { params },
      );
      cacheListResponse(birdOfDayCacheTable, cacheKey, res.data, MAX_ENTRIES);
      return res.data;
    },
  );
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

const fetchAbstract = <T>(
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

  // A single cachedRead for all the list fetchers at once. assertNotGone is
  // deliberately NOT passed to it: a 404 on a list endpoint means "an outdated
  // URL" rather than "the entity is gone", and some of the lists are filtered by
  // the id of offline-first entities with a temp id.
  const readCache = (): T | null => {
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

    return null;
  };

  return cachedRead(fetchUrl, readCache, async () => {
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
  });
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

// The centre a `radius` filter is measured from. Unlike the coordinates that
// only refine a response (fetchAbstract's requestOnlyParams), these decide
// *which* rows come back, so they belong in the cache key — two fixes a
// hundred kilometres apart must never share one "within 50 km" list. Rounded
// to ~100 m so that standing still keeps hitting the same cache entry instead
// of writing a new one per GPS jitter; that is far below the smallest radius
// on offer (see constants/radiusOptions.ts).
//
// No fix, no centre: the server then has nothing to apply the radius to and
// says so in its log (ObservationFilterSet.filter_radius). The filter sheet
// only lets a radius be picked once there is a fix, so this is the rare case
// of losing it afterwards.
const radiusCenterParams = (
  filters: Filters,
  coords?: Coords | null,
): Record<string, number> => {
  if (filters.radius == null) return {};
  const rounded = roundCoords(coords, 3);
  return rounded ? { lng: rounded[0], lat: rounded[1] } : {};
};

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
  // A radius filter is the exception: there the same lng/lat select the rows,
  // so radiusCenterParams puts them in the cache key instead.
  const centerParams = radiusCenterParams(filters, coords);
  const requestOnlyParams =
    isDistanceSort && coords && filters.radius == null
      ? { lng: coords[0], lat: coords[1] }
      : {};
  const data = await fetchAbstract<PaginatedResponse<PlaceItem>>(
    "/myapi/place2/",
    filters,
    order,
    search,
    page,
    centerParams,
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

// Both map modes read the same endpoint: a map of observations is a map of
// places, because an observation carries no geometry of its own — the point
// comes from place_data.location. That keeps the payload at the number of
// places (tens/hundreds) rather than observations (thousands), and the two are
// visually identical anyway: every observation at one place sits on exactly
// the same coordinate.
//
// `scope` is the whole difference. The Observations and Diaries maps each want
// only the places that still have something of theirs; the Places map wants
// every place, an empty one very much included.
type MapPlacesScope = "all" | "withObservations" | "withDiaries";

const MAP_SCOPE_PARAMS: Record<MapPlacesScope, Record<string, boolean>> = {
  all: {},
  withObservations: { has_observations: true },
  withDiaries: { has_diaries: true },
};

const fetchMapPlaces = async (
  filters: Filters,
  search: string | undefined,
  page: number | undefined,
  scope: MapPlacesScope,
) => {
  // Neither map has infinite scroll: both need every point at once to fit the
  // camera and to let MapLibre cluster them. Anything past the first page
  // would be points silently missing from the map, so there is no page 2.
  if ((page ?? 1) > 1) return emptyPaginatedResponse<PlaceItem>();

  // `place` on the observations screen means "observations at this place";
  // against the places endpoint the same intent is a place id, which is why it
  // moves to extraParams rather than staying a filter. `unsynced` is
  // client-only (see fetchPlaces) and locally-created places have no server
  // row to aggregate, so the map simply drops it.
  const { place, unsynced: _unsynced, ...placeFilters } = filters;

  return fetchAbstract<PaginatedResponse<PlaceItem>>(
    "/myapi/place2/",
    placeFilters,
    MAP_PLACES_ORDER,
    search,
    1,
    // extraParams, not requestOnlyParams: these change which rows come back,
    // so they have to take part in the cache key. That is also what keeps the
    // two maps' entries apart in the shared cache table.
    {
      ...MAP_SCOPE_PARAMS[scope],
      ...(place != null ? { id: place } : {}),
    },
    MAP_PLACES_PER_PAGE,
    {
      table: observationPlacesCacheTable,
      maxEntries: MAX_ENTRIES,
      resort: (data, ord) => ({
        ...data,
        results: resortPlaceListItems(data.results, ord),
      }),
    },
  );
};

// The observations map: places that still hold matching observations, each
// sized by how many. Reuses /myapi/place2/, whose counts already honour the
// same filters (Place2ViewSet._get_obs_q); has_observations drops the places
// left with nothing after them.
export const fetchObservationPlaces = (
  filters: Filters,
  // Deliberately ignored. The screen shares its persisted sort between both
  // view modes, and those are observation orderings ("-date_time", "ioc_id")
  // that PlaceFilterSet has no such choice for — forwarding one gets a 400
  // ("-date_time is not one of the available choices"). The map has no order
  // of its own to offer, so fetchMapPlaces always asks for its own.
  _order?: string | null,
  search?: string,
  page?: number,
) => fetchMapPlaces(filters, search, page, "withObservations");

// The diaries map: places that still hold matching outings, each sized by how
// many. Sized by diary_place_count rather than the neighbouring diary_count —
// that one is derived through observations and misses an outing with nothing
// recorded in it yet (see Place2Serializer on the backend).
export const fetchDiaryPlaces = (
  filters: Filters,
  // Ignored for the same reason as fetchObservationPlaces': the screen's
  // persisted sort is a diary ordering PlaceFilterSet has no choice for.
  _order?: string | null,
  search?: string,
  page?: number,
) => fetchMapPlaces(filters, search, page, "withDiaries");

// The places map: every place the list would show, empty ones included.
export const fetchPlacesForMap = (
  filters: Filters,
  _order?: string | null,
  search?: string,
  page?: number,
) => fetchMapPlaces(filters, search, page, "all");

// Observations the map physically cannot show: without a place they have no
// coordinates at all. The screen surfaces the number so they aren't silently
// missing. per_page=1 — only pagination.count is wanted, not a page of rows.
// Uncached on purpose: it is one small number next to a list that already
// paints from cache, and a stale count here would contradict the map beside it.
export const fetchNoPlaceObservationCount = async (
  filters: Filters,
): Promise<number> => {
  const { date, place: _place, unsynced: _unsynced, ...rest } = filters;

  const res = await api.get<PaginatedResponse<ObservationItem>>(
    "/myapi/observation2/",
    {
      params: {
        ...cleanFilters({ ...rest, ...buildDateParams(date) }),
        has_place: false,
        per_page: 1,
      },
    },
  );
  return res.data.pagination.count;
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

/**
 * The one row a place holds, for the maps' sheet.
 *
 * A place with a single observation (or a single outing) has nothing to choose
 * from, so the sheet opens it rather than a filtered list of one. The map
 * carries counts, not ids, so the row itself has to be asked for — through the
 * screen's own fetch, which means the offline cache and the local overlay both
 * still apply.
 *
 * Null whenever the answer is not exactly one row: a count that has drifted
 * from the data, nothing cached while offline, a failed request. The caller
 * then falls back to the filtered list, which is where the tap used to land
 * anyway, so a miss costs the user a screen rather than an error.
 */
const fetchOnlyItemAtPlace = async <T>(
  fetcher: (filters: Filters) => Promise<PaginatedResponse<T>>,
  filters: Filters,
  placeId: number,
): Promise<T | null> => {
  try {
    const { results } = await fetcher({ ...filters, place: placeId });
    return results.length === 1 ? results[0] : null;
  } catch {
    return null;
  }
};

export const fetchOnlyObservationAtPlace = (filters: Filters, placeId: number) =>
  fetchOnlyItemAtPlace(fetchObservations, filters, placeId);

export const fetchOnlyDiaryAtPlace = (filters: Filters, placeId: number) =>
  fetchOnlyItemAtPlace(fetchDiaries, filters, placeId);

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

export const fetchRatingCompareHeader = (
  profile1: number,
  profile2: number,
  filters: Filters | null,
) => {
  const cacheKey = `ratingCompareHeader|${profile1}|${profile2}|${stableStringify((filters ?? {}) as Record<string, unknown>)}`;

  return cachedRead(
    "fetchRatingCompareHeader",
    () => getCachedListResponse(ratingCompareHeaderCacheTable, cacheKey) ?? null,
    async () => {
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
      cacheListResponse(
        ratingCompareHeaderCacheTable,
        cacheKey,
        res.data,
        MAX_ENTRIES,
      );
      return res.data;
    },
    assertNotGone,
  );
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
  // changed — exactly what happened reopening the app in airplane mode. With
  // a radius filter they select the rows instead of refining them, and move
  // into the key (radiusCenterParams).
  const centerParams = radiusCenterParams(filters, coords);
  const requestOnlyParams =
    coords && filters.radius == null ? { lng: coords[0], lat: coords[1] } : {};

  return fetchAbstract<PaginatedResponse<ObservationItem>>(
    "/myapi/community2/",
    filters,
    order,
    search,
    page,
    centerParams,
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

export const fetchUnreadCount = (): Promise<number> =>
  cachedRead(
    "fetchUnreadCount",
    () => {
      const cached = getCachedListResponse<{ count: number }>(
        notificationUnreadCountCacheTable,
        UNREAD_COUNT_CACHE_KEY,
      );
      return cached
        ? notificationRepository.applyPendingUnreadAdjustment(cached.count)
        : null;
    },
    async () => {
      const res = await api.get("/myapi/notifications/unread-count/");
      const count = res.data.count as number;
      cacheListResponse(
        notificationUnreadCountCacheTable,
        UNREAD_COUNT_CACHE_KEY,
        { count },
        1,
      );
      return notificationRepository.applyPendingUnreadAdjustment(count);
    },
  );

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

/**
 * Tell the backend which release this device is on, so it can put a "what's
 * new" (or "update ready") notification into the bell.
 *
 * The call is deliberately made from the device rather than broadcast by the
 * server: only the app knows whether an OTA update has actually been
 * downloaded and applied here, and a broadcast by version would reach half the
 * audience before they have anything to restart into.
 *
 * Returns whether a notification was actually created. A 204 means the backend
 * has nothing to say about this release *yet*: release notes are usually
 * written just after publishing, and often after the first devices have already
 * picked the update up — so "nothing yet" must not be remembered as final, or
 * everyone who asked early would never hear about it.
 */
export const reportAppUpdate = async (params: {
  kind: AppUpdateKind;
  stage: AppUpdateStage;
  revision: string;
}): Promise<boolean> => {
  const res = await api.post("/myapi/notifications/app-update/", {
    ...params,
    platform: Platform.OS, // 'ios' | 'android'
    language: i18n.language,
  });

  return res.status !== 204;
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
