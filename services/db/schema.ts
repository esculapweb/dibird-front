import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";

export const profileTable = sqliteTable("profile", {
  user: integer("user").primaryKey(),
  username: text("username").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull(),
  avatar: text("avatar"),
  avatarThumbnail: text("avatar_thumbnail"),
  private: integer("private", { mode: "boolean" }).notNull(),
  privateDiary: integer("private_diary", { mode: "boolean" }).notNull(),
  registrationIp: text("registration_ip"),
  timezone: text("timezone"),
  territory: integer("territory"),
  status: text("status", { enum: ["synced", "pending", "error"] })
    .notNull()
    .default("synced"),
  updatedAt: integer("updated_at").notNull(),
  // Local file:// URI for an avatar change made while offline (upload) or
  // a pending removal (delete) — see profileRepository.queuePendingAvatar /
  // services/sync/avatarSync.ts. Null once synced. Stored on profileTable
  // rather than a separate mutation payload so the UI can render the pending
  // photo immediately (optimistic) even after an app restart.
  pendingAvatarUri: text("pending_avatar_uri"),
  pendingAvatarOp: text("pending_avatar_op", { enum: ["upload", "delete"] }),
});

export const mutationQueueTable = sqliteTable("mutation_queue", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  entity: text("entity").notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  createdAt: integer("created_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  status: text("status", { enum: ["pending", "error"] })
    .notNull()
    .default("pending"),
});

export const countryTable = sqliteTable("country", {
  value: integer("value").primaryKey(),
  label: text("label").notNull(),
  code: text("code").notNull(),
  favourite: integer("favourite", { mode: "boolean" }).notNull(),
});

export const timezoneTable = sqliteTable("timezone", {
  value: text("value").primaryKey(),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

// Shared shape for every offline read-cache table (see
// hooks/repositories/listCacheRepository.ts) — one dedicated table per data
// kind rather than a single shared pool, so heavy browsing in one area (e.g.
// Stat/Rating lists, which have a huge filter/sort/search/page combination
// space) can't evict another area's cache (e.g. species/places dropdowns,
// which offline observation/diary editing depends on).
// Exported (not just used locally) so listCacheRepository.ts can type its
// generic functions against ReturnType<typeof cacheTable> — every table built
// by this factory ends up with the exact same TS shape (the `name` argument
// is typed as plain `string`, not a literal, so drizzle infers a single
// shared type across all 13 calls instead of 13 nominally distinct ones).
export const cacheTable = (name: string) =>
  sqliteTable(
    name,
    {
      key: text("key").primaryKey(),
      response: text("response", { mode: "json" }).notNull(),
      updatedAt: integer("updated_at").notNull(),
    },
    (table) => [index(`${name}_updated_at_idx`).on(table.updatedAt)],
  );

export const speciesDropdownCacheTable = cacheTable("species_dropdown_cache");
export const placesDropdownCacheTable = cacheTable("places_dropdown_cache");
export const statCacheTable = cacheTable("stat_cache");
export const checklistCacheTable = cacheTable("checklist_cache");
export const placesListCacheTable = cacheTable("places_list_cache");
export const observationsListCacheTable = cacheTable("observations_list_cache");
export const diariesListCacheTable = cacheTable("diaries_list_cache");
export const diaryObservationsListCacheTable = cacheTable(
  "diary_observations_list_cache",
);
export const ratingCacheTable = cacheTable("rating_cache");
export const ratingCompareCacheTable = cacheTable("rating_compare_cache");
export const ratingCompareHeaderCacheTable = cacheTable(
  "rating_compare_header_cache",
);
export const communityObservationsCacheTable = cacheTable(
  "community_observations_cache",
);
export const communityItemCacheTable = cacheTable("community_item_cache");
export const notificationsListCacheTable = cacheTable("notifications_list_cache");
// Privacy/Terms content (see fetchPage in util/fetches.ts) — static,
// server-authoritative, read-only, same read-through shape as
// communityItemCacheTable in useItem.ts.
export const staticPageCacheTable = cacheTable("static_page_cache");
// Single-row cache (see fetchUnreadCount in util/fetches.ts) rather than a
// per-query key, but reuses the same {key, response, updatedAt} shape so it
// can go through the same cacheListResponse/getCachedListResponse helpers.
export const notificationUnreadCountCacheTable = cacheTable(
  "notification_unread_count_cache",
);
// Main screen reads (see fetchMyDashboardStat/fetchMyActivity/fetchBirdOfDay
// in util/fetches.ts) — pure reads, no local mutation, same read-through
// cache-fallback shape as fetchMyCountries/fetchSpecies.
export const dashboardStatCacheTable = cacheTable("dashboard_stat_cache");
export const activityCacheTable = cacheTable("activity_cache");
export const birdOfDayCacheTable = cacheTable("bird_of_day_cache");
// Secondary reads (see fetchUserProfile/fetchMapPreview/fetchDiarySpeciesIds
// in util/fetches.ts) — same read-through cache-fallback shape, added so a
// cold start offline doesn't lose data that was visible moments before the
// app was killed (React Query's own cache is in-memory only, see
// services/queryClient.ts).
export const userProfileCacheTable = cacheTable("user_profile_cache");
export const mapPreviewCacheTable = cacheTable("map_preview_cache");
export const diarySpeciesIdsCacheTable = cacheTable("diary_species_ids_cache");
// Taxonomy catalog reads (see fetchTaxonList/fetchTaxonDetail in
// util/fetches.ts) — same read-through cache-fallback shape, one table for
// every rank's list (order/family/genus/species) since the cache key already
// encodes rank + parent + search + page.
export const taxonListCacheTable = cacheTable("taxon_list_cache");
export const taxonDetailCacheTable = cacheTable("taxon_detail_cache");
// Countries/territories catalogue reads (see fetchTerritoryList/
// fetchTerritoryDetail/fetchTerritoryChecklist/fetchTerritoryCompare in
// util/fetches.ts). Kept apart from the taxon tables because a territory's
// checklist is a single huge response (one row can be ~2000 species) — left
// in the same pool it would evict a lot of much smaller taxon entries.
export const territoryListCacheTable = cacheTable("territory_list_cache");
export const territoryDetailCacheTable = cacheTable("territory_detail_cache");

// Durable local record of "read" state applied on top of whatever's in
// notifications_list_cache (see notificationRepository.applyOverlay) — needed
// because, unlike diary/observation/place, notifications have no per-item
// local mirror row to patch a cached list against, and a cached page's
// is_read flag would otherwise stay stale forever once marked read locally
// until that exact page is re-fetched from the server.
// id: a real notification id for an explicitly marked-read item, or the
// sentinel -1 for "mark all read" — its readAt is then a "read before this
// timestamp" cutoff compared against each item's created_at, so notifications
// that arrive after a mark-all correctly stay unread.
export const notificationReadOverlayTable = sqliteTable(
  "notification_read_overlay",
  {
    id: integer("id").primaryKey(),
    readAt: integer("read_at").notNull(),
  },
);

export const observationTable = sqliteTable("observation", {
  // negative id = local temp id for an unsynced create, positive = real server id
  id: integer("id").primaryKey(),
  data: text("data", { mode: "json" }).notNull(),
  op: text("op", { enum: ["create", "update", "delete"] }),
  status: text("status", { enum: ["synced", "pending", "error"] })
    .notNull()
    .default("synced"),
  lastError: text("last_error"),
  updatedAt: integer("updated_at").notNull(),
});

export const diaryTable = sqliteTable("diary", {
  // negative id = local temp id for an unsynced create, positive = real server id
  id: integer("id").primaryKey(),
  data: text("data", { mode: "json" }).notNull(),
  op: text("op", { enum: ["create", "update", "delete"] }),
  status: text("status", { enum: ["synced", "pending", "error"] })
    .notNull()
    .default("synced"),
  lastError: text("last_error"),
  updatedAt: integer("updated_at").notNull(),
});

export const placeTable = sqliteTable("place", {
  // negative id = local temp id for an unsynced create, positive = real server id
  id: integer("id").primaryKey(),
  data: text("data", { mode: "json" }).notNull(),
  op: text("op", { enum: ["create", "update", "delete"] }),
  status: text("status", { enum: ["synced", "pending", "error"] })
    .notNull()
    .default("synced"),
  lastError: text("last_error"),
  updatedAt: integer("updated_at").notNull(),
});

// Single-row local mirror of the server's alert-settings object (GET/PATCH
// /myapi/alert-settings/me/) — a settings object, not a list of entities, so
// unlike observation/diary/place there's no op/create/delete, just one row
// patched in place. Mirrors profileTable's role, but stored as a JSON blob
// since nothing filters on individual alert-settings columns locally.
export const alertSettingsTable = sqliteTable("alert_settings", {
  id: integer("id").primaryKey(), // singleton row, always 1
  data: text("data", { mode: "json" }).notNull(),
  status: text("status", { enum: ["synced", "pending", "error"] })
    .notNull()
    .default("synced"),
  lastError: text("last_error"),
  updatedAt: integer("updated_at").notNull(),
});
