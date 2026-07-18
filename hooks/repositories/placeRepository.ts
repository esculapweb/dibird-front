import { and, asc, eq, isNotNull } from "drizzle-orm";

import { db } from "../../services/db/client";
import { placeTable, mutationQueueTable } from "../../services/db/schema";
import { territoryDataFor } from "./shared";
import * as observationRepository from "./observationRepository";
import { PaginatedResponse, PlaceDropdownItem, PlaceFormData, PlaceItem } from "../../types";

type PlaceRow = typeof placeTable.$inferSelect;
export type MutationRow = typeof mutationQueueTable.$inferSelect;

export type PlaceMutationPayload =
  | { op: "create"; localId: number; data: PlaceFormData; clientRequestId: string }
  | { op: "update"; localId: number; data: Partial<PlaceFormData> }
  | { op: "delete"; localId: number };

let tempIdCounter = 0;
const nextTempId = () => -(Date.now() * 1000 + (tempIdCounter++ % 1000));

// See observationRepository.ts's makeClientRequestId — same idempotency-key
// purpose, kept as a separate id space per entity.
export const makeClientRequestId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const rowToItem = (row: PlaceRow): PlaceItem => {
  const item = row.data as PlaceItem;
  if (row.status === "synced" || !row.op) {
    return { ...item, _pendingSync: undefined, _syncError: undefined };
  }
  return {
    ...item,
    _pendingSync: row.status === "error" ? "error" : "pending",
    _syncError: row.lastError ?? undefined,
  };
};

export const getPlace = (id: number): PlaceItem | null => {
  const rows = db.select().from(placeTable).where(eq(placeTable.id, id)).all();
  return rows[0] ? rowToItem(rows[0]) : null;
};

// Cross-entity resolution for an observation/diary's `place` field (see
// services/sync/observationSync.ts and services/sync/diarySync.ts):
// - null/positive id: nothing to resolve, returned unchanged.
// - negative id whose local row is gone (place deleted/discarded before it
//   ever synced), or whose own create mutation hit a real (non-network)
//   error: returns undefined — this reference can never resolve on its own.
//   Without the error case, a place that permanently failed to sync (status
//   stays "error", the row is never deleted) looked identical to one that
//   simply hadn't synced *yet* — callers kept deferring the dependent
//   observation/diary forever instead of ever surfacing the failure.
// - negative id whose local row still exists and is only pending: returns
//   its current `.id`, which is still the same negative id until the place
//   itself syncs, or the real server id once replaceLocalWithServer has run.
export const resolvePlaceId = (
  id: number | null | undefined,
): number | null | undefined => {
  if (id == null || id > 0) return id;
  const local = getPlace(id);
  if (!local || local._pendingSync === "error") return undefined;
  return local.id;
};

export const upsertFromServer = (item: PlaceItem) => {
  const row = {
    id: item.id,
    data: item,
    op: null,
    status: "synced" as const,
    lastError: null,
    updatedAt: Date.now(),
  };
  db.insert(placeTable)
    .values(row)
    .onConflictDoUpdate({ target: placeTable.id, set: row })
    .run();
};

// Builds a full, displayable PlaceItem from a form submission (full or
// partial) for offline use. Unlike diaryRepository.ts's synthesize(), every
// field here falls back to `base` (not straight to null/0) when absent from
// `payload` — Place is updated both from the full PlaceEditor form *and* as a
// bare partial patch (PlaceDetailScreen's favourite-star toggle only sends
// `{ favourite }`), so a field missing from `payload` must never be treated
// as "the user cleared it".
const synthesize = (
  id: number,
  base: PlaceItem | null,
  payload: Partial<PlaceFormData>,
): PlaceItem => {
  const now = new Date().toISOString();
  const territory = payload.territory ?? base?.territory ?? base?.territory_data?.id ?? 0;

  return {
    id,
    name: payload.name ?? base?.name ?? "",
    favourite: payload.favourite ?? base?.favourite ?? false,
    location: payload.location ?? base?.location ?? { type: "Point", coordinates: [0, 0] },
    distance: base?.distance ?? null,
    preview: base?.preview ?? null,
    diary_count: base?.diary_count ?? 0,
    observation_count: base?.observation_count ?? 0,
    species_count: base?.species_count ?? 0,
    territory,
    territory_data: base?.territory_data ?? territoryDataFor(territory),
    created_at: base?.created_at ?? now,
    updated_at: now,
  };
};

export const createLocal = (
  payload: PlaceFormData,
  clientRequestId: string,
): PlaceItem => {
  const id = nextTempId();
  const item = synthesize(id, null, payload);

  db.transaction((tx) => {
    tx.insert(placeTable)
      .values({ id, data: item, op: "create", status: "pending", updatedAt: Date.now() })
      .run();

    tx.insert(mutationQueueTable)
      .values({
        entity: "place",
        payload: {
          op: "create",
          localId: id,
          data: payload,
          clientRequestId,
        } satisfies PlaceMutationPayload,
        createdAt: Date.now(),
      })
      .run();
  });

  return item;
};

export const updateLocal = (
  id: number,
  payload: Partial<PlaceFormData>,
  currentItem: PlaceItem | null,
): PlaceItem => {
  const existingRow = db.select().from(placeTable).where(eq(placeTable.id, id)).all()[0];

  const isUnsyncedDraft = id < 0 && existingRow?.op === "create" && existingRow.status !== "synced";

  const base = currentItem ?? (existingRow ? (existingRow.data as PlaceItem) : null);
  const merged = synthesize(id, base, payload);

  if (isUnsyncedDraft) {
    // Never left the device yet — amend the still-pending create in place
    // instead of queuing a second mutation for the same not-yet-existing place.
    db.transaction((tx) => {
      tx.update(placeTable)
        .set({ data: merged, updatedAt: Date.now() })
        .where(eq(placeTable.id, id))
        .run();

      // Not filtered to status "pending": a create that already failed once
      // (e.g. server-side "name already exists") sits here with status
      // "error" until explicitly retried — excluding it meant editing a
      // failed draft never updated the queued payload, so retrying kept
      // resending the stale data and reproducing the same error forever.
      const pendingCreate = tx
        .select()
        .from(mutationQueueTable)
        .where(eq(mutationQueueTable.entity, "place"))
        .all()
        .find(
          (m) =>
            (m.payload as PlaceMutationPayload).op === "create" &&
            (m.payload as PlaceMutationPayload).localId === id,
        );

      if (pendingCreate) {
        const clientRequestId = (pendingCreate.payload as PlaceMutationPayload & {
          op: "create";
        }).clientRequestId;
        tx.update(mutationQueueTable)
          .set({
            payload: {
              op: "create",
              localId: id,
              data: { name: merged.name, territory: merged.territory, favourite: merged.favourite, location: merged.location },
              clientRequestId,
            } satisfies PlaceMutationPayload,
          })
          .where(eq(mutationQueueTable.id, pendingCreate.id))
          .run();
      }
    });

    return merged;
  }

  db.transaction((tx) => {
    tx.insert(placeTable)
      .values({ id, data: merged, op: "update", status: "pending", updatedAt: Date.now() })
      .onConflictDoUpdate({
        target: placeTable.id,
        set: { data: merged, op: "update", status: "pending", lastError: null, updatedAt: Date.now() },
      })
      .run();

    tx.insert(mutationQueueTable)
      .values({
        entity: "place",
        payload: { op: "update", localId: id, data: payload } satisfies PlaceMutationPayload,
        createdAt: Date.now(),
      })
      .run();
  });

  return merged;
};

export const deleteLocal = (id: number): void => {
  const existingRow = db.select().from(placeTable).where(eq(placeTable.id, id)).all()[0];

  const isUnsyncedDraft = id < 0 && existingRow?.op === "create" && existingRow.status !== "synced";

  if (isUnsyncedDraft) {
    db.transaction((tx) => {
      tx.delete(placeTable).where(eq(placeTable.id, id)).run();

      tx.select()
        .from(mutationQueueTable)
        .where(eq(mutationQueueTable.entity, "place"))
        .all()
        .filter((m) => (m.payload as PlaceMutationPayload).localId === id)
        .forEach((m) => tx.delete(mutationQueueTable).where(eq(mutationQueueTable.id, m.id)).run());
    });
    return;
  }

  db.transaction((tx) => {
    const data = existingRow ? (existingRow.data as PlaceItem) : ({ id } as PlaceItem);
    tx.insert(placeTable)
      .values({ id, data, op: "delete", status: "pending", updatedAt: Date.now() })
      .onConflictDoUpdate({
        target: placeTable.id,
        set: { op: "delete", status: "pending", lastError: null, updatedAt: Date.now() },
      })
      .run();

    tx.insert(mutationQueueTable)
      .values({
        entity: "place",
        payload: { op: "delete", localId: id } satisfies PlaceMutationPayload,
        createdAt: Date.now(),
      })
      .run();
  });
};

// Called only by the sync engine after a queued create succeeds. Keeps the
// old temp-id row alive as a resolved alias (so a screen still holding the
// temp id in its route params keeps reading successfully, and so
// resolvePlaceId can look up the real id for any observation/diary still
// referencing this place by its temp id) and writes the canonical row under
// the real server id.
export const replaceLocalWithServer = (localId: number, serverItem: PlaceItem) => {
  db.transaction((tx) => {
    const aliasRow = {
      id: localId,
      data: serverItem,
      op: null,
      status: "synced" as const,
      lastError: null,
      updatedAt: Date.now(),
    };
    tx.insert(placeTable)
      .values(aliasRow)
      .onConflictDoUpdate({ target: placeTable.id, set: aliasRow })
      .run();

    const realRow = {
      id: serverItem.id,
      data: serverItem,
      op: null,
      status: "synced" as const,
      lastError: null,
      updatedAt: Date.now(),
    };
    tx.insert(placeTable)
      .values(realRow)
      .onConflictDoUpdate({ target: placeTable.id, set: realRow })
      .run();
  });
};

export const removeLocal = (id: number) => {
  db.delete(placeTable).where(eq(placeTable.id, id)).run();
};

// Same atomic claim-and-remove pattern as observationRepository.ts's
// claimNextMutation — see its comment for why this needs to be atomic.
export const claimNextMutation = (): MutationRow | null =>
  db.transaction((tx) => {
    const [row] = tx
      .select()
      .from(mutationQueueTable)
      .where(and(eq(mutationQueueTable.entity, "place"), eq(mutationQueueTable.status, "pending")))
      .orderBy(asc(mutationQueueTable.createdAt))
      .limit(1)
      .all();

    if (!row) return null;

    tx.delete(mutationQueueTable).where(eq(mutationQueueTable.id, row.id)).run();
    return row;
  });

export const requeuePendingMutation = (
  payload: PlaceMutationPayload,
  createdAt: number,
  attempts: number,
) => {
  db.insert(mutationQueueTable)
    .values({ entity: "place", payload, createdAt, attempts, status: "pending" })
    .run();
};

export const requeueFailedMutation = (
  payload: PlaceMutationPayload,
  createdAt: number,
  attempts: number,
  localId: number,
  message: string,
) => {
  db.transaction((tx) => {
    tx.insert(mutationQueueTable)
      .values({
        entity: "place",
        payload,
        createdAt,
        attempts: attempts + 1,
        status: "error",
        lastError: message,
      })
      .run();

    tx.update(placeTable)
      .set({ status: "error", lastError: message })
      .where(eq(placeTable.id, localId))
      .run();
  });
};

export const getFailedMutations = (): MutationRow[] =>
  db
    .select()
    .from(mutationQueueTable)
    .where(and(eq(mutationQueueTable.entity, "place"), eq(mutationQueueTable.status, "error")))
    .orderBy(asc(mutationQueueTable.createdAt))
    .all();

export const getFailedMutationFor = (localId: number): MutationRow | null =>
  getFailedMutations().find((m) => (m.payload as PlaceMutationPayload).localId === localId) ?? null;

export const retryMutation = (mutationId: number, localId: number) => {
  db.transaction((tx) => {
    tx.update(mutationQueueTable)
      .set({ status: "pending", lastError: null })
      .where(eq(mutationQueueTable.id, mutationId))
      .run();

    tx.update(placeTable)
      .set({ status: "pending", lastError: null })
      .where(eq(placeTable.id, localId))
      .run();
  });
};

export const discardMutation = (mutationId: number, localId: number) => {
  db.transaction((tx) => {
    tx.delete(mutationQueueTable).where(eq(mutationQueueTable.id, mutationId)).run();
    tx.delete(placeTable).where(eq(placeTable.id, localId)).run();
  });
};

interface Overlay {
  pendingCreates: PlaceItem[];
  patchesById: Map<number, PlaceItem>;
  deletedIds: Set<number>;
}

export const getOverlay = (): Overlay => {
  const rows = db.select().from(placeTable).where(isNotNull(placeTable.op)).all();

  const pendingCreates: PlaceItem[] = [];
  const patchesById = new Map<number, PlaceItem>();
  const deletedIds = new Set<number>();

  for (const row of rows) {
    const item = rowToItem(row);
    if (row.op === "create") {
      if (row.status !== "synced") pendingCreates.push(item);
    } else if (row.op === "update") {
      patchesById.set(row.id, item);
    } else if (row.op === "delete") {
      if (row.status === "pending") deletedIds.add(row.id);
      else patchesById.set(row.id, item);
    }
  }

  pendingCreates.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return { pendingCreates, patchesById, deletedIds };
};

// A place's own observation_count/diary_count/species_count are only ever
// refreshed when the *place itself* syncs (create/update) — an observation
// finishing its own sync never touches the place row. So a place that just
// gained an offline observation (or was itself created offline alongside
// one) shows stale counts until that unrelated sync happens to occur. Folds
// any currently pending (not yet synced) observation creates for this place
// into display-only count adjustments — mirrors diaryRepository.ts's
// withPendingObservations for the same reason. Deliberately not persisted:
// call this only where a PlaceItem is being handed to the UI, never before
// writing to placeTable, or the adjustment could get baked into a later
// local update's base snapshot and double-count once the observation
// actually syncs.
export const withPendingObservationCount = (item: PlaceItem): PlaceItem => {
  const pendingForPlace = observationRepository
    .getOverlay()
    .pendingCreates.filter((o) => o.place === item.id);
  if (pendingForPlace.length === 0) return item;

  // Mirrors the backend's own definition for this endpoint exactly
  // (UserDataExportService.get_places: diary_count=Count("observation__diary_id")
  // — deliberately *not* distinct) — it's really "observations at this place
  // that belong to a diary", not a distinct-diary count, so counting pending
  // diary-scoped observations the same way keeps this consistent with what
  // the number becomes once synced.
  const pendingDiaryObservations = pendingForPlace.filter((o) => o.diary != null).length;

  // species_count can only be approximated offline: the server's number is
  // *distinct* species ever recorded at this place, but locally we only have
  // the aggregate count, not the actual set of previously-seen species ids —
  // so a pending observation of a species already seen here before this
  // offline session would get over-counted as "new". Still strictly better
  // than leaving it stale for the common case (a genuinely new record), and
  // self-corrects the moment this place is next fetched from the server.
  const distinctPendingSpecies = new Set(pendingForPlace.map((o) => o.species)).size;

  return {
    ...item,
    observation_count: item.observation_count + pendingForPlace.length,
    diary_count: item.diary_count + pendingDiaryObservations,
    species_count: item.species_count + distinctPendingSpecies,
  };
};

// Backs the client-only "unsynced" filter (see util/fetches.ts's
// fetchPlaces). Every row getOverlay() returns already has a queued mutation
// still pending or errored — a successful sync always
// replaceLocalWithServer's/removeLocal's the row — so this is simply all of
// it, with the same pending-observation-count adjustment as applyOverlay.
export const getUnsyncedItems = (): PlaceItem[] => {
  const { pendingCreates, patchesById } = getOverlay();
  return [...pendingCreates, ...patchesById.values()].map(withPendingObservationCount);
};

export const applyOverlay = (
  response: PaginatedResponse<PlaceItem>,
  page: number,
): PaginatedResponse<PlaceItem> => {
  const { pendingCreates, patchesById, deletedIds } = getOverlay();

  let results = response.results
    .filter((item) => !deletedIds.has(item.id))
    .map((item) => patchesById.get(item.id) ?? item)
    .map(withPendingObservationCount);

  let count = Math.max(0, response.pagination.count - deletedIds.size);

  if (page === 1) {
    const existingIds = new Set(results.map((item) => item.id));
    const toPrepend = pendingCreates
      .filter((item) => !existingIds.has(item.id))
      .map(withPendingObservationCount);
    results = [...toPrepend, ...results];
    count += toPrepend.length;
  }

  return { ...response, results, pagination: { ...response.pagination, count } };
};

const toDropdownItem = (place: PlaceItem): PlaceDropdownItem => ({
  value: place.id,
  label: place.name,
  name: place.name,
  iconLabel: place.favourite ? "star" : undefined,
  location: place.location,
  distance: place.distance ?? undefined,
  preview: place.preview ?? undefined,
});

// The place picker (components/ui/PlaceDropdown.tsx, used by the
// Observation/Diary editors' "select an existing place" flow — distinct
// from PlaceEditorScreen's "add new place" flow, which gets the freshly
// created item handed to it directly via callNavigationCallback and never
// goes through this list) reads from util/fetches.ts's fetchMyPlaces, a
// separate endpoint/cache from fetchPlaces. Without this overlay, a place
// created while offline is invisible in that picker until it actually syncs
// (the live request legitimately doesn't know about it yet, and the
// picker's own response cache is keyed by the network response, unrelated
// to this repository's local table) — splice it in the same way applyOverlay
// does for the main Places list.
export const applyDropdownOverlay = (
  items: PlaceDropdownItem[],
  territory: number | null,
): PlaceDropdownItem[] => {
  const { pendingCreates, deletedIds } = getOverlay();

  const filtered = items.filter((item) => !deletedIds.has(item.value as number));
  const existingIds = new Set(filtered.map((item) => item.value));

  const toPrepend = pendingCreates
    .filter((place) => place.territory === territory && !existingIds.has(place.id))
    .map(toDropdownItem);

  return [...toPrepend, ...filtered];
};

// Same reasoning as observationRepository.clearAllLocal — wipes every
// locally-known place (synced mirror rows + pending mutations) plus its
// queued mutations, on an account switch rather than ordinary logout.
export const clearAllLocal = () => {
  db.transaction((tx) => {
    tx.delete(placeTable).run();
    tx.delete(mutationQueueTable).where(eq(mutationQueueTable.entity, "place")).run();
  });
};
