import { and, asc, eq, inArray, or, sql } from "drizzle-orm";

import { db } from "../../services/db/client";
import {
  mutationQueueTable,
  observationPhotoTable,
  observationTable,
} from "../../services/db/schema";
import { ObservationItem, ObservationPhoto } from "../../types";

type PhotoRow = typeof observationPhotoTable.$inferSelect;
export type MutationRow = typeof mutationQueueTable.$inferSelect;

const ENTITY = "observationPhoto";

// Drizzle's transaction handle is a different type from the database handle,
// so helpers that run either standalone or inside a transaction take both.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbOrTx = typeof db | Tx;

export type ObservationPhotoMutationPayload =
  | { op: "upload"; photoLocalId: number; observationLocalId: number }
  | { op: "delete"; photoLocalId: number; observationLocalId: number };

export interface PhotoDraft {
  uri: string;
  // Persisted file:// URI (see util/photoFiles.ts) — the picker's own output
  // lives in the cache directory, which the OS may purge before the upload
  // gets its turn.
  sortOrder?: number;
}

let tempIdCounter = 0;
// Same shape as observationRepository's nextTempId: negative, monotonic, and
// unique within a session even when several photos are queued in one tick.
const nextPhotoTempId = () => -(Date.now() * 1000 + (tempIdCounter++ % 1000));

const makeClientRequestId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// Every write to the photo list of an observation goes through here, because
// one observation can occupy two rows at once: after replaceLocalWithServer
// the temp-id row survives as an alias (a screen may still hold the temp id in
// its route params) alongside the canonical row under the real server id.
// Patching only one of them leaves the other showing a stale photo strip.
const patchObservationPhotos = (
  observationIds: number[],
  patch: (photos: ObservationPhoto[]) => ObservationPhoto[],
  tx: DbOrTx = db,
) => {
  const matching = (ids: number[]) =>
    tx
      .select()
      .from(observationTable)
      .where(
        or(
          inArray(observationTable.id, ids),
          inArray(sql`json_extract(${observationTable.data}, '$.id')`, ids),
        ),
      )
      .all();

  // One pass to find the rows, a second to catch the other half of an
  // alias/real pair: an alias row is keyed by the temp id but carries the real
  // one inside `data`, so starting from either id has to reach both.
  const seed = matching([...new Set(observationIds)]);
  const ids = [
    ...new Set([
      ...observationIds,
      ...seed.map((row) => row.id),
      ...seed
        .map((row) => (row.data as ObservationItem).id)
        .filter((id): id is number => id != null),
    ]),
  ];
  const rows = matching(ids);

  for (const row of rows) {
    const item = row.data as ObservationItem;
    const photos = patch(item.photos ?? []);
    tx.update(observationTable)
      .set({ data: { ...item, photos }, updatedAt: Date.now() })
      .where(eq(observationTable.id, row.id))
      .run();
  }
};

const bySortOrder = (photos: ObservationPhoto[]) =>
  [...photos].sort((a, b) => a.sort_order - b.sort_order);

// Current photo count of an observation, used to continue sort_order rather
// than restart it — two photos with the same sort_order would render in an
// order the server and the client disagree about.
const currentPhotos = (observationId: number): ObservationPhoto[] => {
  const row = db
    .select()
    .from(observationTable)
    .where(eq(observationTable.id, observationId))
    .all()[0];
  return ((row?.data as ObservationItem | undefined)?.photos ?? []) as ObservationPhoto[];
};

// Queues one or more picked photos for upload and shows them right away.
export const queueUploads = (observationId: number, drafts: PhotoDraft[]): void => {
  if (drafts.length === 0) return;

  const startOrder = currentPhotos(observationId).reduce(
    (max, photo) => Math.max(max, photo.sort_order + 1),
    0,
  );
  const now = Date.now();

  db.transaction((tx) => {
    const added: ObservationPhoto[] = [];

    drafts.forEach((draft, index) => {
      const id = nextPhotoTempId();
      const sortOrder = draft.sortOrder ?? startOrder + index;
      const clientRequestId = makeClientRequestId();

      tx.insert(observationPhotoTable)
        .values({
          id,
          observationId,
          serverId: null,
          localUri: draft.uri,
          sortOrder,
          clientRequestId,
          op: "upload",
          status: "pending",
          createdAt: now,
        })
        .run();

      tx.insert(mutationQueueTable)
        .values({
          entity: ENTITY,
          payload: {
            op: "upload",
            photoLocalId: id,
            observationLocalId: observationId,
          } satisfies ObservationPhotoMutationPayload,
          createdAt: now,
        })
        .run();

      added.push({
        id,
        image: null,
        thumbnail: null,
        sort_order: sortOrder,
        created_at: new Date(now).toISOString(),
        local_uri: draft.uri,
        _pendingSync: "pending",
      });
    });

    patchObservationPhotos(
      [observationId],
      (photos) => bySortOrder([...photos, ...added]),
      tx,
    );
  });
};

// Removes a photo. A photo that never left the device is simply dropped along
// with its queued upload — there is nothing on the server to delete, and
// sending one would 404. Returns the local file to delete, if any.
export const queueDelete = (
  observationId: number,
  photo: ObservationPhoto,
): string | null => {
  let fileToDelete: string | null = null;

  db.transaction((tx) => {
    if (photo.id < 0) {
      const row = tx
        .select()
        .from(observationPhotoTable)
        .where(eq(observationPhotoTable.id, photo.id))
        .all()[0];
      fileToDelete = row?.localUri ?? photo.local_uri ?? null;

      tx.delete(observationPhotoTable)
        .where(eq(observationPhotoTable.id, photo.id))
        .run();
      deleteQueuedMutationsFor(photo.id, tx);
    } else {
      const id = nextPhotoTempId();

      tx.insert(observationPhotoTable)
        .values({
          id,
          observationId,
          serverId: photo.id,
          localUri: null,
          sortOrder: photo.sort_order,
          clientRequestId: null,
          op: "delete",
          status: "pending",
          createdAt: Date.now(),
        })
        .run();

      tx.insert(mutationQueueTable)
        .values({
          entity: ENTITY,
          payload: {
            op: "delete",
            photoLocalId: id,
            observationLocalId: observationId,
          } satisfies ObservationPhotoMutationPayload,
          createdAt: Date.now(),
        })
        .run();
    }

    patchObservationPhotos(
      [observationId],
      (photos) => photos.filter((p) => p.id !== photo.id),
      tx,
    );
  });

  return fileToDelete;
};

const deleteQueuedMutationsFor = (photoLocalId: number, tx: DbOrTx = db) => {
  tx.select()
    .from(mutationQueueTable)
    .where(eq(mutationQueueTable.entity, ENTITY))
    .all()
    .filter(
      (m) =>
        (m.payload as ObservationPhotoMutationPayload).photoLocalId === photoLocalId,
    )
    .forEach((m) =>
      tx.delete(mutationQueueTable).where(eq(mutationQueueTable.id, m.id)).run(),
    );
};

export const getPhotoRow = (localId: number): PhotoRow | null =>
  db
    .select()
    .from(observationPhotoTable)
    .where(eq(observationPhotoTable.id, localId))
    .all()[0] ?? null;

// Atomically dequeues the oldest pending photo mutation — same reasoning as
// observationRepository.claimNextMutation: several sync triggers can fire at
// once, and a read-then-delete window would upload the same file twice.
export const claimNextMutation = (): MutationRow | null =>
  db.transaction((tx) => {
    const [row] = tx
      .select()
      .from(mutationQueueTable)
      .where(
        and(
          eq(mutationQueueTable.entity, ENTITY),
          eq(mutationQueueTable.status, "pending"),
        ),
      )
      .orderBy(asc(mutationQueueTable.createdAt))
      .limit(1)
      .all();

    if (!row) return null;

    tx.delete(mutationQueueTable).where(eq(mutationQueueTable.id, row.id)).run();
    return row;
  });

export const requeuePendingMutation = (
  payload: ObservationPhotoMutationPayload,
  createdAt: number,
  attempts: number,
) => {
  db.insert(mutationQueueTable)
    .values({ entity: ENTITY, payload, createdAt, attempts, status: "pending" })
    .run();
};

// A real (non-network) error: the queue row comes back as failed and the
// optimistic entry in the observation gets an error badge, so the failure is
// visible on the photo itself rather than on the whole observation.
export const requeueFailedMutation = (
  payload: ObservationPhotoMutationPayload,
  createdAt: number,
  attempts: number,
  message: string,
) => {
  db.transaction((tx) => {
    tx.insert(mutationQueueTable)
      .values({
        entity: ENTITY,
        payload,
        createdAt,
        attempts: attempts + 1,
        status: "error",
        lastError: message,
      })
      .run();

    tx.update(observationPhotoTable)
      .set({ status: "error", lastError: message })
      .where(eq(observationPhotoTable.id, payload.photoLocalId))
      .run();

    patchObservationPhotos(
      [payload.observationLocalId],
      (photos) =>
        photos.map((photo) =>
          photo.id === payload.photoLocalId
            ? { ...photo, _pendingSync: "error", _syncError: message }
            : photo,
        ),
      tx,
    );
  });
};

// The upload landed: the optimistic entry is replaced by the server's own, in
// place, so the strip doesn't reorder under the user. Returns the local file,
// which is no longer needed once the server has a copy.
export const resolveUpload = (
  localId: number,
  observationIds: number[],
  serverPhoto: ObservationPhoto,
): string | null => {
  const row = getPhotoRow(localId);

  db.transaction((tx) => {
    tx.delete(observationPhotoTable)
      .where(eq(observationPhotoTable.id, localId))
      .run();

    patchObservationPhotos(
      observationIds,
      (photos) =>
        bySortOrder(
          photos.map((photo) =>
            photo.id === localId
              ? {
                  ...serverPhoto,
                  sort_order: serverPhoto.sort_order ?? photo.sort_order,
                }
              : photo,
          ),
        ),
      tx,
    );
  });

  return row?.localUri ?? null;
};

export const resolveDelete = (localId: number): void => {
  db.delete(observationPhotoTable)
    .where(eq(observationPhotoTable.id, localId))
    .run();
};

// The parent observation can never be referenced again (discarded, or its own
// create failed permanently — see observationRepository.resolveObservationId),
// so a photo queued against it has nowhere to go. Dropped outright instead of
// retried forever. Returns the local file to delete.
export const discardPhoto = (localId: number): string | null => {
  const row = getPhotoRow(localId);

  db.transaction((tx) => {
    tx.delete(observationPhotoTable)
      .where(eq(observationPhotoTable.id, localId))
      .run();
    deleteQueuedMutationsFor(localId, tx);
  });

  return row?.localUri ?? null;
};

// A queued deletion that failed for a real reason: the photo goes back into
// the strip, so the user sees that it is still there rather than silently
// losing track of it.
export const restorePhoto = (
  observationId: number,
  photo: ObservationPhoto,
): void => {
  patchObservationPhotos(
    [observationId],
    (photos) =>
      photos.some((p) => p.id === photo.id)
        ? photos
        : bySortOrder([...photos, photo]),
  );
};

// Local files of every photo queued for one observation, returned so the
// caller can delete them; used when the observation itself goes away.
export const clearForObservation = (observationId: number): string[] => {
  const rows = db
    .select()
    .from(observationPhotoTable)
    .where(eq(observationPhotoTable.observationId, observationId))
    .all();

  db.transaction((tx) => {
    rows.forEach((row) => deleteQueuedMutationsFor(row.id, tx));
    tx.delete(observationPhotoTable)
      .where(eq(observationPhotoTable.observationId, observationId))
      .run();
  });

  return rows.map((row) => row.localUri).filter((uri): uri is string => !!uri);
};

// Wipes every queued photo — called when a different account logs in on the
// same device, alongside observationRepository.clearAllLocal.
export const clearAllLocal = (): string[] => {
  const rows = db.select().from(observationPhotoTable).all();

  db.transaction((tx) => {
    tx.delete(observationPhotoTable).run();
    tx.delete(mutationQueueTable).where(eq(mutationQueueTable.entity, ENTITY)).run();
  });

  return rows.map((row) => row.localUri).filter((uri): uri is string => !!uri);
};
