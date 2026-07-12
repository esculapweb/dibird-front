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
