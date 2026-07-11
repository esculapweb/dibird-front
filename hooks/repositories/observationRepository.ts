import { and, asc, eq, isNotNull } from "drizzle-orm";

import { db } from "../../services/db/client";
import { mutationQueueTable, observationTable } from "../../services/db/schema";
import { territoryDataFor, ownerFromProfile } from "./shared";
import {
  DiaryObservationItem,
  ObservationFormData,
  ObservationItem,
  PaginatedResponse,
  PlaceDropdownItem,
  Profile,
  SpeciesDropdownItem,
} from "../../types";

type ObservationRow = typeof observationTable.$inferSelect;
export type MutationRow = typeof mutationQueueTable.$inferSelect;

export type ObservationMutationPayload =
  | { op: "create"; localId: number; data: ObservationFormData; clientRequestId: string }
  | { op: "update"; localId: number; data: ObservationFormData }
  | { op: "delete"; localId: number };

export interface SynthesizeExtras {
  speciesData?: SpeciesDropdownItem | null;
  placeData?: PlaceDropdownItem | null;
  // A diary-scoped observation's form never carries its own territory (it's
  // implicit from the diary server-side — see ObservationEditorScreen's
  // buildObservationPayload), so payload.territory is always undefined for
  // one. Without this, synthesize() below would fall all the way through to
  // `null`/id 0, which then wins over any better fallback wherever this
  // observation is later read back (e.g. useEditorForm's territoryValue
  // init), disabling anything gated on having a territory — the species
  // picker included. The caller (useOfflineObservation.ts) resolves this
  // from the parent diary via diaryRepository before calling create/updateLocal.
  diaryTerritory?: number | null;
}

let tempIdCounter = 0;
const nextTempId = () => -(Date.now() * 1000 + (tempIdCounter++ % 1000));

// Identifies one logical create attempt across every retry of it (the initial
// live POST and every subsequent queued retry after a response-less failure
// send the same value as `client_request_id`). This alone can't stop a
// duplicate — the server has to recognize a repeated id and return the
// existing row instead of creating another one — but the client can't do
// anything about that half without a matching backend change (see callers).
export const makeClientRequestId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const rowToItem = (row: ObservationRow): ObservationItem => {
  const item = row.data as ObservationItem;
  if (row.status === "synced" || !row.op) {
    return { ...item, _pendingSync: undefined, _syncError: undefined };
  }
  return {
    ...item,
    _pendingSync: row.status === "error" ? "error" : "pending",
    _syncError: row.lastError ?? undefined,
  };
};

export const getObservation = (id: number): ObservationItem | null => {
  const rows = db
    .select()
    .from(observationTable)
    .where(eq(observationTable.id, id))
    .all();
  return rows[0] ? rowToItem(rows[0]) : null;
};

export const upsertFromServer = (item: ObservationItem) => {
  const row = {
    id: item.id,
    data: item,
    op: null,
    status: "synced" as const,
    lastError: null,
    updatedAt: Date.now(),
  };
  db.insert(observationTable)
    .values(row)
    .onConflictDoUpdate({ target: observationTable.id, set: row })
    .run();
};

// Builds a full, displayable ObservationItem from a form submission for offline
// use. `payload` always carries the complete current form state (both create and
// update submit the whole form, not a sparse diff — see ObservationEditorScreen),
// so every editable field comes straight from it; `base` (the previously known
// item, if any) only fills in fields the form doesn't own: id/created_at/owner,
// and a fallback for the denormalized *_data snapshots when fresh dropdown data
// wasn't supplied.
const synthesize = (
  id: number,
  base: ObservationItem | null,
  payload: ObservationFormData,
  extras: SynthesizeExtras,
  profile: Profile | null | undefined,
): ObservationItem => {
  const now = new Date().toISOString();
  const species = payload.species ?? base?.species ?? 0;

  return {
    id,
    created_at: base?.created_at ?? now,
    updated_at: now,
    notes: payload.notes ?? null,
    quantity: payload.quantity ?? null,
    time: payload.time ?? null,
    date_time: payload.date_time ?? base?.date_time ?? now,
    diary: payload.diary ?? base?.diary ?? null,
    is_owner: true,
    owner: base?.owner ?? ownerFromProfile(profile),
    place: payload.place ?? null,
    // If we have no fresh dropdown data for the new place, only reuse `base`'s
    // snapshot when it actually still describes payload.place — otherwise
    // (place id changed but we weren't handed the new place's data) showing
    // base's stale name/photo would misattribute a *different* place's data to
    // this place id, which is worse than showing nothing.
    place_data:
      payload.place == null
        ? null
        : extras.placeData
          ? {
              id: extras.placeData.value as number,
              name: extras.placeData.label,
              preview: extras.placeData.preview ?? null,
              location: extras.placeData.location ?? null,
            }
          : base?.place_data?.id === payload.place
            ? base.place_data
            : null,
    private: payload.private ?? base?.private ?? false,
    territory:
      payload.territory ??
      extras.diaryTerritory ??
      base?.territory ??
      base?.territory_data?.id ??
      null,
    species,
    // Same reasoning as place_data above: base's species_data is only a valid
    // fallback when it still matches the resolved species id.
    species_data: extras.speciesData
      ? {
          id: extras.speciesData.value as number,
          name: extras.speciesData.name ?? "",
          name_lang: extras.speciesData.name_lang ?? extras.speciesData.label,
          segment: extras.speciesData.segment ?? "",
          thumb: extras.speciesData.thumb ?? null,
        }
      : base?.species_data?.id === species
        ? base.species_data
        : { id: species, name: "", name_lang: "", segment: "", thumb: null },
    territory_data:
      base?.territory_data ?? territoryDataFor(payload.territory ?? extras.diaryTerritory),
    location_private: payload.location_private ?? base?.location_private ?? true,
    external_source: null,
    external_username: null,
    distance: undefined,
  };
};

export const createLocal = (
  payload: ObservationFormData,
  extras: SynthesizeExtras,
  profile: Profile | null | undefined,
  clientRequestId: string,
): ObservationItem => {
  const id = nextTempId();
  const item = synthesize(id, null, payload, extras, profile);

  db.transaction((tx) => {
    tx.insert(observationTable)
      .values({ id, data: item, op: "create", status: "pending", updatedAt: Date.now() })
      .run();

    tx.insert(mutationQueueTable)
      .values({
        entity: "observation",
        payload: {
          op: "create",
          localId: id,
          data: payload,
          clientRequestId,
        } satisfies ObservationMutationPayload,
        createdAt: Date.now(),
      })
      .run();
  });

  return item;
};

export const updateLocal = (
  id: number,
  payload: ObservationFormData,
  currentItem: ObservationItem | null,
  extras: SynthesizeExtras,
  profile: Profile | null | undefined,
): ObservationItem => {
  const existingRow = db
    .select()
    .from(observationTable)
    .where(eq(observationTable.id, id))
    .all()[0];

  const isUnsyncedDraft = id < 0 && existingRow?.op === "create" && existingRow.status !== "synced";

  const base = currentItem ?? (existingRow ? (existingRow.data as ObservationItem) : null);
  const merged = synthesize(id, base, payload, extras, profile);

  if (isUnsyncedDraft) {
    // Never left the device yet — amend the still-pending create in place instead
    // of queuing a second mutation for the same not-yet-existing observation.
    db.transaction((tx) => {
      tx.update(observationTable)
        .set({ data: merged, updatedAt: Date.now() })
        .where(eq(observationTable.id, id))
        .run();

      const pendingCreate = tx
        .select()
        .from(mutationQueueTable)
        .where(
          and(
            eq(mutationQueueTable.entity, "observation"),
            eq(mutationQueueTable.status, "pending"),
          ),
        )
        .all()
        .find(
          (m) =>
            (m.payload as ObservationMutationPayload).op === "create" &&
            (m.payload as ObservationMutationPayload).localId === id,
        );

      if (pendingCreate) {
        const clientRequestId = (pendingCreate.payload as ObservationMutationPayload & {
          op: "create";
        }).clientRequestId;
        tx.update(mutationQueueTable)
          .set({
            payload: {
              op: "create",
              localId: id,
              data: payload,
              clientRequestId,
            } satisfies ObservationMutationPayload,
          })
          .where(eq(mutationQueueTable.id, pendingCreate.id))
          .run();
      }
    });

    return merged;
  }

  db.transaction((tx) => {
    tx.insert(observationTable)
      .values({ id, data: merged, op: "update", status: "pending", updatedAt: Date.now() })
      .onConflictDoUpdate({
        target: observationTable.id,
        set: { data: merged, op: "update", status: "pending", lastError: null, updatedAt: Date.now() },
      })
      .run();

    tx.insert(mutationQueueTable)
      .values({
        entity: "observation",
        payload: { op: "update", localId: id, data: payload } satisfies ObservationMutationPayload,
        createdAt: Date.now(),
      })
      .run();
  });

  return merged;
};

export const deleteLocal = (id: number): void => {
  const existingRow = db
    .select()
    .from(observationTable)
    .where(eq(observationTable.id, id))
    .all()[0];

  const isUnsyncedDraft = id < 0 && existingRow?.op === "create" && existingRow.status !== "synced";

  if (isUnsyncedDraft) {
    db.transaction((tx) => {
      tx.delete(observationTable).where(eq(observationTable.id, id)).run();

      tx.select()
        .from(mutationQueueTable)
        .where(
          and(
            eq(mutationQueueTable.entity, "observation"),
            eq(mutationQueueTable.status, "pending"),
          ),
        )
        .all()
        .filter((m) => (m.payload as ObservationMutationPayload).localId === id)
        .forEach((m) => tx.delete(mutationQueueTable).where(eq(mutationQueueTable.id, m.id)).run());
    });
    return;
  }

  db.transaction((tx) => {
    const data = existingRow ? (existingRow.data as ObservationItem) : ({ id } as ObservationItem);
    tx.insert(observationTable)
      .values({ id, data, op: "delete", status: "pending", updatedAt: Date.now() })
      .onConflictDoUpdate({
        target: observationTable.id,
        set: { op: "delete", status: "pending", lastError: null, updatedAt: Date.now() },
      })
      .run();

    tx.insert(mutationQueueTable)
      .values({
        entity: "observation",
        payload: { op: "delete", localId: id } satisfies ObservationMutationPayload,
        createdAt: Date.now(),
      })
      .run();
  });
};

// Called only by the sync engine after a queued create succeeds. Keeps the old
// temp-id row alive as a resolved alias (so a screen still holding the temp id
// in its route params keeps reading successfully) and writes the canonical row
// under the real server id.
export const replaceLocalWithServer = (localId: number, serverItem: ObservationItem) => {
  db.transaction((tx) => {
    const aliasRow = {
      id: localId,
      data: serverItem,
      op: null,
      status: "synced" as const,
      lastError: null,
      updatedAt: Date.now(),
    };
    tx.insert(observationTable)
      .values(aliasRow)
      .onConflictDoUpdate({ target: observationTable.id, set: aliasRow })
      .run();

    const realRow = {
      id: serverItem.id,
      data: serverItem,
      op: null,
      status: "synced" as const,
      lastError: null,
      updatedAt: Date.now(),
    };
    tx.insert(observationTable)
      .values(realRow)
      .onConflictDoUpdate({ target: observationTable.id, set: realRow })
      .run();
  });
};

export const removeLocal = (id: number) => {
  db.delete(observationTable).where(eq(observationTable.id, id)).run();
};

// Atomically dequeues the single oldest pending mutation (select+delete in one
// transaction) instead of just reading it. A plain read-then-later-delete left
// a window where two overlapping sync passes (the reconnect listener, the
// focus-effect retries, app-foreground — several independent triggers can
// legitimately fire close together) could both read the same still-pending
// "create" and each POST it, creating duplicates on the server. Claiming one
// row at a time, atomically, means a second pass simply finds nothing left to
// claim for that mutation, no matter how the two calls interleave — this is
// the actual data-layer guarantee; the in-flight lock in observationSync.ts is
// just a (redundant but cheap) fast path on top of it.
export const claimNextMutation = (): MutationRow | null =>
  db.transaction((tx) => {
    const [row] = tx
      .select()
      .from(mutationQueueTable)
      .where(
        and(
          eq(mutationQueueTable.entity, "observation"),
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

// Puts a claimed mutation back after a network/timeout failure so it's retried
// later, preserving its original ordering and attempt count.
export const requeuePendingMutation = (
  payload: ObservationMutationPayload,
  createdAt: number,
  attempts: number,
) => {
  db.insert(mutationQueueTable)
    .values({ entity: "observation", payload, createdAt, attempts, status: "pending" })
    .run();
};

// Re-inserts a claimed mutation as failed after a real (non-network) error —
// the original row is already gone (claimed), so this recreates it in the
// "error" state rather than updating it in place.
export const requeueFailedMutation = (
  payload: ObservationMutationPayload,
  createdAt: number,
  attempts: number,
  localId: number,
  message: string,
) => {
  db.transaction((tx) => {
    tx.insert(mutationQueueTable)
      .values({
        entity: "observation",
        payload,
        createdAt,
        attempts: attempts + 1,
        status: "error",
        lastError: message,
      })
      .run();

    tx.update(observationTable)
      .set({ status: "error", lastError: message })
      .where(eq(observationTable.id, localId))
      .run();
  });
};

export const getFailedMutations = (): MutationRow[] =>
  db
    .select()
    .from(mutationQueueTable)
    .where(
      and(
        eq(mutationQueueTable.entity, "observation"),
        eq(mutationQueueTable.status, "error"),
      ),
    )
    .orderBy(asc(mutationQueueTable.createdAt))
    .all();

export const getFailedMutationFor = (localId: number): MutationRow | null =>
  getFailedMutations().find(
    (m) => (m.payload as ObservationMutationPayload).localId === localId,
  ) ?? null;

export const retryMutation = (mutationId: number, localId: number) => {
  db.transaction((tx) => {
    tx.update(mutationQueueTable)
      .set({ status: "pending", lastError: null })
      .where(eq(mutationQueueTable.id, mutationId))
      .run();

    tx.update(observationTable)
      .set({ status: "pending", lastError: null })
      .where(eq(observationTable.id, localId))
      .run();
  });
};

export const discardMutation = (mutationId: number, localId: number) => {
  db.transaction((tx) => {
    tx.delete(mutationQueueTable).where(eq(mutationQueueTable.id, mutationId)).run();
    // Drop our local override entirely — a create draft is abandoned outright,
    // and an update/delete override falls back to server/list-cache truth.
    tx.delete(observationTable).where(eq(observationTable.id, localId)).run();
  });
};

interface Overlay {
  pendingCreates: ObservationItem[];
  patchesById: Map<number, ObservationItem>;
  deletedIds: Set<number>;
}

export const getOverlay = (): Overlay => {
  const rows = db
    .select()
    .from(observationTable)
    .where(isNotNull(observationTable.op))
    .all();

  const pendingCreates: ObservationItem[] = [];
  const patchesById = new Map<number, ObservationItem>();
  const deletedIds = new Set<number>();

  for (const row of rows) {
    const item = rowToItem(row);
    if (row.op === "create") {
      if (row.status !== "synced") pendingCreates.push(item);
    } else if (row.op === "update") {
      patchesById.set(row.id, item);
    } else if (row.op === "delete") {
      if (row.status === "pending") deletedIds.add(row.id);
      // A delete that failed to sync (real error, not a network error) is shown
      // back in the list with an error badge rather than silently disappearing.
      else patchesById.set(row.id, item);
    }
  }

  pendingCreates.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return { pendingCreates, patchesById, deletedIds };
};

export const applyOverlay = (
  response: PaginatedResponse<ObservationItem>,
  page: number,
): PaginatedResponse<ObservationItem> => {
  const { pendingCreates, patchesById, deletedIds } = getOverlay();
  if (pendingCreates.length === 0 && patchesById.size === 0 && deletedIds.size === 0) {
    return response;
  }

  let results = response.results
    .filter((item) => !deletedIds.has(item.id))
    .map((item) => patchesById.get(item.id) ?? item);

  let count = Math.max(0, response.pagination.count - deletedIds.size);

  if (page === 1) {
    const existingIds = new Set(results.map((item) => item.id));
    const toPrepend = pendingCreates.filter((item) => !existingIds.has(item.id));
    results = [...toPrepend, ...results];
    count += toPrepend.length;
  }

  return { ...response, results, pagination: { ...response.pagination, count } };
};

const toDiaryObservationItem = (item: ObservationItem): DiaryObservationItem => ({
  id: item.id,
  created_at: item.created_at,
  notes: item.notes,
  quantity: item.quantity,
  time: item.time,
  species_data: item.species_data,
});

// Diary-scoped counterpart of applyOverlay above: DiaryDetailScreen's
// observation list is filtered server-side to a single diary (filters.diary),
// so the overlay merged into it must be filtered the same way — otherwise a
// pending observation belonging to a *different* diary would leak in, and
// deletedIds (which spans every diary) would over-subtract this diary's count.
export const applyDiaryOverlay = (
  response: PaginatedResponse<DiaryObservationItem>,
  diaryId: number | null | undefined,
  page: number,
): PaginatedResponse<DiaryObservationItem> => {
  if (diaryId == null) return response;

  const { pendingCreates, patchesById, deletedIds } = getOverlay();
  const relevantCreates = pendingCreates.filter((item) => item.diary === diaryId);
  const relevantPatches = new Map(
    [...patchesById].filter(([, item]) => item.diary === diaryId),
  );

  if (relevantCreates.length === 0 && relevantPatches.size === 0 && deletedIds.size === 0) {
    return response;
  }

  const deletedInPage = response.results.filter((item) => deletedIds.has(item.id));

  let results = response.results
    .filter((item) => !deletedIds.has(item.id))
    .map((item) =>
      relevantPatches.has(item.id)
        ? toDiaryObservationItem(relevantPatches.get(item.id)!)
        : item,
    );

  let count = Math.max(0, response.pagination.count - deletedInPage.length);

  if (page === 1) {
    const existingIds = new Set(results.map((item) => item.id));
    const toPrepend = relevantCreates
      .filter((item) => !existingIds.has(item.id))
      .map(toDiaryObservationItem);
    results = [...toPrepend, ...results];
    count += toPrepend.length;
  }

  return { ...response, results, pagination: { ...response.pagination, count } };
};
