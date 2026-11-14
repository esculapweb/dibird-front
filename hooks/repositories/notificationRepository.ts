import { asc, eq, sql } from "drizzle-orm";

import { db } from "../../services/db/client";
import {
  mutationQueueTable,
  notificationReadOverlayTable,
  notificationsListCacheTable,
} from "../../services/db/schema";
import { AppNotification, PaginatedResponse } from "../../types";

type MutationRow = typeof mutationQueueTable.$inferSelect;

export type NotificationMutationPayload =
  | { op: "markIds"; ids: number[] }
  | { op: "markAll" };

// Sentinel id in notification_read_overlay for a "mark all read" cutoff (see
// schema.ts's comment on notificationReadOverlayTable).
const MARK_ALL_SENTINEL_ID = -1;

export const markIdsReadLocal = (ids: number[]): void => {
  if (ids.length === 0) return;
  const now = Date.now();

  db.transaction((tx) => {
    ids.forEach((id) => {
      tx.insert(notificationReadOverlayTable)
        .values({ id, readAt: now })
        .onConflictDoUpdate({
          target: notificationReadOverlayTable.id,
          set: { readAt: now },
        })
        .run();
    });

    tx.insert(mutationQueueTable)
      .values({
        entity: "notification",
        payload: { op: "markIds", ids } satisfies NotificationMutationPayload,
        createdAt: now,
      })
      .run();
  });
};

// The newest server-side created_at among the cached notification pages, in
// ms — or null when nothing is cached (then there's nothing on screen to flip
// either).
const newestCachedCreatedAt = (
  tx: Pick<typeof db, "select">,
): number | null => {
  const rows = tx
    .select({ response: notificationsListCacheTable.response })
    .from(notificationsListCacheTable)
    .all();

  let newest: number | null = null;
  for (const row of rows) {
    const results =
      (row.response as Partial<PaginatedResponse<AppNotification>> | null)
        ?.results ?? [];
    for (const item of results) {
      const createdAt = Date.parse(item?.created_at ?? "");
      if (!Number.isNaN(createdAt) && (newest == null || createdAt > newest)) {
        newest = createdAt;
      }
    }
  }
  return newest;
};

export const markAllReadLocal = (): void => {
  const now = Date.now();

  db.transaction((tx) => {
    // The cutoff is a server timestamp, not Date.now(): applyOverlay compares
    // it with the server's created_at, and the sentinel outlives the sync. A
    // device clock running ahead used to make every notification arriving
    // within that skew look read for good, though the server had it unread
    // (#490). "All" here means all the user could see — anything newer than
    // the newest cached item is the server's to mark, which it does on sync.
    const cutoff = newestCachedCreatedAt(tx);
    if (cutoff != null) {
      tx.insert(notificationReadOverlayTable)
        .values({ id: MARK_ALL_SENTINEL_ID, readAt: cutoff })
        .onConflictDoUpdate({
          target: notificationReadOverlayTable.id,
          // Never move an earlier mark-all's cutoff backwards.
          set: {
            readAt: sql`max(${notificationReadOverlayTable.readAt}, excluded.read_at)`,
          },
        })
        .run();
    }

    tx.insert(mutationQueueTable)
      .values({
        entity: "notification",
        payload: { op: "markAll" } satisfies NotificationMutationPayload,
        createdAt: now,
      })
      .run();
  });
};

interface ReadOverlay {
  readIds: Set<number>;
  allReadBefore: number | null;
}

const getReadOverlay = (): ReadOverlay => {
  const rows = db.select().from(notificationReadOverlayTable).all();

  const readIds = new Set<number>();
  let allReadBefore: number | null = null;

  for (const row of rows) {
    if (row.id === MARK_ALL_SENTINEL_ID) allReadBefore = row.readAt;
    else readIds.add(row.id);
  }

  return { readIds, allReadBefore };
};

// Flips is_read on top of a fetched/cached page using the durable local
// overlay — applied regardless of whether the page just came from the
// network or from offline cache, since a cached page can be older than the
// last local mark-read.
export const applyOverlay = (
  response: PaginatedResponse<AppNotification>,
): PaginatedResponse<AppNotification> => {
  const { readIds, allReadBefore } = getReadOverlay();
  if (readIds.size === 0 && allReadBefore == null) return response;

  const results = response.results.map((item) => {
    if (item.is_read) return item;
    const read =
      readIds.has(item.id) ||
      (allReadBefore != null &&
        new Date(item.created_at).getTime() <= allReadBefore);
    return read ? { ...item, is_read: true } : item;
  });

  return { ...response, results };
};

// Transient (unlike the overlay above): only reflects mutations still
// sitting in the queue, so it self-corrects to 0 the moment they sync and the
// server's own count already accounts for them — used to keep the unread
// badge in sync with a mark-read that hasn't reached the server yet.
export const getPendingUnreadAdjustment = (): {
  markAll: boolean;
  ids: Set<number>;
} => {
  const rows = db
    .select()
    .from(mutationQueueTable)
    .where(eq(mutationQueueTable.entity, "notification"))
    .all();

  let markAll = false;
  const ids = new Set<number>();

  for (const row of rows) {
    const payload = row.payload as NotificationMutationPayload;
    if (payload.op === "markAll") markAll = true;
    else payload.ids.forEach((id) => ids.add(id));
  }

  return { markAll, ids };
};

export const applyPendingUnreadAdjustment = (count: number): number => {
  const { markAll, ids } = getPendingUnreadAdjustment();
  if (markAll) return 0;
  return Math.max(0, count - ids.size);
};

// Same atomic claim-and-remove pattern as diaryRepository.ts's
// claimNextMutation.
export const claimNextMutation = (): MutationRow | null =>
  db.transaction((tx) => {
    const [row] = tx
      .select()
      .from(mutationQueueTable)
      .where(eq(mutationQueueTable.entity, "notification"))
      .orderBy(asc(mutationQueueTable.createdAt))
      .limit(1)
      .all();

    if (!row) return null;

    tx.delete(mutationQueueTable).where(eq(mutationQueueTable.id, row.id)).run();
    return row;
  });

export const requeuePendingMutation = (
  payload: NotificationMutationPayload,
  createdAt: number,
  attempts: number,
) => {
  db.insert(mutationQueueTable)
    .values({ entity: "notification", payload, createdAt, attempts, status: "pending" })
    .run();
};
