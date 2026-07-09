import { asc, desc, eq, inArray, like } from "drizzle-orm";

import { db } from "../../services/db/client";
import { listCacheTable } from "../../services/db/schema";

const MAX_ENTRIES = 200;

export const cacheListResponse = (key: string, response: unknown) => {
  db.transaction((tx) => {
    tx.insert(listCacheTable)
      .values({ key, response, updatedAt: Date.now() })
      .onConflictDoUpdate({
        target: listCacheTable.key,
        set: { response, updatedAt: Date.now() },
      })
      .run();

    const rows = tx
      .select({ key: listCacheTable.key })
      .from(listCacheTable)
      .orderBy(asc(listCacheTable.updatedAt))
      .all();

    if (rows.length > MAX_ENTRIES) {
      const staleKeys = rows
        .slice(0, rows.length - MAX_ENTRIES)
        .map((row) => row.key);
      tx.delete(listCacheTable)
        .where(inArray(listCacheTable.key, staleKeys))
        .run();
    }
  });
};

export const getCachedListResponse = <T>(key: string): T | null => {
  const rows = db
    .select()
    .from(listCacheTable)
    .where(eq(listCacheTable.key, key))
    .all();

  return rows[0] ? (rows[0].response as T) : null;
};

export const getCachedListResponseByPrefix = <T>(prefix: string): T | null => {
  const rows = db
    .select()
    .from(listCacheTable)
    .where(like(listCacheTable.key, `${prefix}%`))
    .orderBy(desc(listCacheTable.updatedAt))
    .limit(1)
    .all();

  return rows[0] ? (rows[0].response as T) : null;
};
