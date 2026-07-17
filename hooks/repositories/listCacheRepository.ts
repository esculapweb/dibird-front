import { asc, desc, eq, inArray, like, sql } from "drizzle-orm";

import { db } from "../../services/db/client";
import {
  cacheTable,
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
  communityItemCacheTable,
  notificationsListCacheTable,
  staticPageCacheTable,
  notificationUnreadCountCacheTable,
  dashboardStatCacheTable,
  activityCacheTable,
  birdOfDayCacheTable,
  userProfileCacheTable,
  mapPreviewCacheTable,
  diarySpeciesIdsCacheTable,
} from "../../services/db/schema";

// Every table built by the cacheTable factory (schema.ts) shares this exact
// TS shape, so these functions work generically across all of them — one
// dedicated table per data kind (species dropdown, Stat list, ...), not one
// shared pool, so heavy browsing in one area can't evict another's cache.
export type CacheTable = ReturnType<typeof cacheTable>;

// Only pay for the "find and delete the oldest rows" step once meaningfully
// over the cap, not on every single write — most writes just upsert their one
// row and move on. Keeps write cost roughly constant regardless of maxEntries.
const HYSTERESIS_FRACTION = 0.1;
const MIN_HYSTERESIS = 20;

export const cacheListResponse = (
  table: CacheTable,
  key: string,
  response: unknown,
  maxEntries: number,
) => {
  db.transaction((tx) => {
    tx.insert(table)
      .values({ key, response, updatedAt: Date.now() })
      .onConflictDoUpdate({
        target: table.key,
        set: { response, updatedAt: Date.now() },
      })
      .run();

    const hysteresis = Math.max(
      MIN_HYSTERESIS,
      Math.round(maxEntries * HYSTERESIS_FRACTION),
    );
    const [{ count }] = tx
      .select({ count: sql<number>`count(*)` })
      .from(table)
      .all();

    if (count > maxEntries + hysteresis) {
      // ORDER BY updated_at ASC LIMIT n walks the table's updated_at index
      // (see the cacheTable factory in schema.ts) and stops after `toDelete`
      // rows, instead of pulling and sorting every row in the table.
      const stale = tx
        .select({ key: table.key })
        .from(table)
        .orderBy(asc(table.updatedAt))
        .limit(count - maxEntries)
        .all();

      if (stale.length > 0) {
        tx.delete(table)
          .where(
            inArray(
              table.key,
              stale.map((row) => row.key),
            ),
          )
          .run();
      }
    }
  });
};

export const getCachedListResponse = <T>(
  table: CacheTable,
  key: string,
): T | null => {
  const rows = db.select().from(table).where(eq(table.key, key)).all();
  return rows[0] ? (rows[0].response as T) : null;
};

export const getCachedListResponseByPrefix = <T>(
  table: CacheTable,
  prefix: string,
): T | null => {
  const rows = db
    .select()
    .from(table)
    .where(like(table.key, `${prefix}%`))
    .orderBy(desc(table.updatedAt))
    .limit(1)
    .all();

  return rows[0] ? (rows[0].response as T) : null;
};

// Every offline read-cache table built by the cacheTable factory (see
// schema.ts) — kept as one explicit list rather than reflecting over the
// schema module, so adding a new cache table can't silently skip this. Called
// on logout: none of this is user-specific-safe to keep around (e.g. a
// cached Places/Countries dropdown list carries per-user `favourite` flags),
// and it's all cheap to refetch.
const ALL_CACHE_TABLES: CacheTable[] = [
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
  communityItemCacheTable,
  notificationsListCacheTable,
  staticPageCacheTable,
  notificationUnreadCountCacheTable,
  dashboardStatCacheTable,
  activityCacheTable,
  birdOfDayCacheTable,
  userProfileCacheTable,
  mapPreviewCacheTable,
  diarySpeciesIdsCacheTable,
];

export const clearAllListCaches = () => {
  db.transaction((tx) => {
    for (const table of ALL_CACHE_TABLES) {
      tx.delete(table).run();
    }
  });
};
