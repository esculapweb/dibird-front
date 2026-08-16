import { and, asc, eq, isNotNull, or, sql } from "drizzle-orm";

import { db } from "../../services/db/client";
import { diaryTable, mutationQueueTable } from "../../services/db/schema";
import { territoryDataFor, ownerFromProfile } from "./shared";
import * as observationRepository from "./observationRepository";
import {
  DiaryFormData,
  DiaryItem,
  DiaryListItem,
  PaginatedResponse,
  PlaceDropdownItem,
  Profile,
} from "../../types";

type DiaryRow = typeof diaryTable.$inferSelect;
export type MutationRow = typeof mutationQueueTable.$inferSelect;

// The detail endpoint (DiaryItem: owner/created_at/user_data/...) and the list
// endpoint (DiaryListItem: observation_data thumbnails) are different shapes
// server-side, unlike Observation where one type covers both. Everything
// synthesized/cached locally needs to work as *either*, since the same local
// row can be read back by the detail screen (as DiaryItem) or spliced into a
// list response by applyOverlay (as DiaryListItem) — so the repository's
// internal representation is the superset of both.
export type DiaryRecord = DiaryItem & { observation_data: DiaryListItem["observation_data"] };

export type DiaryMutationPayload =
  | { op: "create"; localId: number; data: DiaryFormData; clientRequestId: string }
  | { op: "update"; localId: number; data: DiaryFormData }
  | { op: "delete"; localId: number };

export interface SynthesizeExtras {
  placeData?: PlaceDropdownItem | null;
}

let tempIdCounter = 0;
const nextTempId = () => -(Date.now() * 1000 + (tempIdCounter++ % 1000));

// See observationRepository.ts's makeClientRequestId — same idempotency-key
// purpose, kept as a separate id space per entity.
export const makeClientRequestId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const rowToItem = (row: DiaryRow): DiaryRecord => {
  const item = row.data as DiaryRecord;
  if (row.status === "synced" || !row.op) {
    return { ...item, _pendingSync: undefined, _syncError: undefined };
  }
  return {
    ...item,
    _pendingSync: row.status === "error" ? "error" : "pending",
    _syncError: row.lastError ?? undefined,
  };
};

export const getDiary = (id: number): DiaryRecord | null => {
  const rows = db.select().from(diaryTable).where(eq(diaryTable.id, id)).all();
  return rows[0] ? rowToItem(rows[0]) : null;
};

// Cross-entity resolution for an observation's `diary` field (see
// hooks/Observation/useOfflineObservation.ts and services/sync/observationSync.ts):
// - null/positive id: nothing to resolve, returned unchanged.
// - negative id whose local row is gone (diary deleted/discarded before it ever
//   synced), or whose own create mutation hit a real (non-network) error:
//   returns undefined — this reference can never resolve on its own. Without
//   the error case, a diary that permanently failed to sync (status stays
//   "error", the row is never deleted) looked identical to one that simply
//   hadn't synced *yet* — callers kept deferring the dependent observation
//   forever instead of ever surfacing the failure.
// - negative id whose local row still exists and is only pending: returns its
//   current `.id`, which is still the same negative id if the diary hasn't
//   synced yet, or the real server id once replaceLocalWithServer has run (the
//   alias row's `data.id` becomes the server id while the row's own primary
//   key stays the old temp id).
export const resolveDiaryId = (
  id: number | null | undefined,
): number | null | undefined => {
  if (id == null || id > 0) return id;
  const local = getDiary(id);
  if (!local || local._pendingSync === "error") return undefined;
  return local.id;
};

// A server response is not always the full detail shape: the create/list
// endpoint (Diary2Serializer) is a strict *subset* of the detail one
// (Diary2SingleSerializer) — it carries no is_owner/owner/user_data/created_at/
// updated_at. Writing such a response verbatim over a locally synthesized
// record dropped exactly those fields, and DiaryDetailScreen gates edit/delete/
// add-observation on `is_owner` — so the moment an offline create synced, the
// owner saw their own diary as somebody else's (blank author, no actions) until
// the next detail GET, which offline never comes. Merging keeps the server
// authoritative for every field it actually sends while preserving the
// detail-only ones the local row already knows — which is what DiaryRecord
// being the superset of both shapes is for (see its comment above).
const mergedWithLocal = (id: number, item: DiaryItem) => {
  const existing = db.select().from(diaryTable).where(eq(diaryTable.id, id)).all()[0];
  return { ...(existing?.data as DiaryRecord | undefined), ...item };
};

export const upsertFromServer = (item: DiaryItem) => {
  const row = {
    id: item.id,
    data: mergedWithLocal(item.id, item),
    op: null,
    status: "synced" as const,
    lastError: null,
    updatedAt: Date.now(),
  };
  db.insert(diaryTable)
    .values(row)
    .onConflictDoUpdate({ target: diaryTable.id, set: row })
    .run();
};

// A lighter version of upsertFromServer for a best-effort snapshot seeded from
// list data (see useDiaryItem's initialData) rather than an authoritative
// individual GET/mutation response — deliberately does *not* overwrite a row
// that currently has a local mutation pending (op set), since this snapshot
// could be stale relative to that in-flight change and clobbering it would
// silently hide the pending-sync state (getOverlay filters on op being set)
// until the mutation completes on its own. Exists so a diary only ever seen
// in a list (never individually fetched) still has a locally-known
// observation_count — used by fetchDiaryObservations's offline fallback to
// tell "genuinely zero observations" apart from "never cached".
export const cacheKnownSnapshot = (item: DiaryRecord) => {
  const existing = db.select().from(diaryTable).where(eq(diaryTable.id, item.id)).all()[0];
  if (existing && existing.op != null) return;

  const row = {
    id: item.id,
    data: item,
    op: null,
    status: "synced" as const,
    lastError: null,
    updatedAt: Date.now(),
  };
  db.insert(diaryTable)
    .values(row)
    .onConflictDoUpdate({ target: diaryTable.id, set: row })
    .run();
};

// Builds a full, displayable DiaryItem from a form submission for offline use.
// Mirrors observationRepository.ts's synthesize(): `payload` always carries the
// complete current form state, `base` only fills in fields the form doesn't own
// (id/created_at/owner/observation_count) and a guarded fallback for the
// denormalized place_data snapshot when fresh dropdown data wasn't supplied.
const synthesize = (
  id: number,
  base: DiaryRecord | null,
  payload: DiaryFormData,
  extras: SynthesizeExtras,
  profile: Profile | null | undefined,
): DiaryRecord => {
  const now = new Date().toISOString();
  const owner = base?.owner ?? ownerFromProfile(profile);
  const territory = payload.territory ?? base?.territory ?? base?.territory_data?.id ?? 0;

  return {
    id,
    created_at: base?.created_at ?? now,
    updated_at: now,
    date_time: payload.date_time ?? base?.date_time ?? now,
    name: payload.name ?? null,
    observation_count: base?.observation_count ?? 0,
    is_owner: true,
    owner,
    user_data: base?.user_data ?? {
      avatar: owner.avatar,
      first_name: owner.first_name,
      id: owner.id,
      last_name: owner.last_name,
      timezone_id: owner.timezone_id,
      username: owner.username,
    },
    profile: profile?.user ?? base?.profile ?? 0,
    place: payload.place ?? null,
    // Same reasoning as observationRepository.ts's synthesize(): only reuse
    // base's place_data snapshot when it still matches the resolved place id,
    // otherwise showing it would misattribute a *different* place's data.
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
    territory,
    territory_data: base?.territory_data ?? territoryDataFor(territory),
    location_private: payload.location_private ?? base?.location_private ?? true,
    // Editing a diary's own fields never changes which observations are in
    // it — always carry the previous snapshot forward (defaults to empty for
    // a brand-new diary, which genuinely has none yet).
    observation_data: base?.observation_data ?? [],
  };
};

export const createLocal = (
  payload: DiaryFormData,
  extras: SynthesizeExtras,
  profile: Profile | null | undefined,
  clientRequestId: string,
): DiaryRecord => {
  const id = nextTempId();
  const item = synthesize(id, null, payload, extras, profile);

  db.transaction((tx) => {
    tx.insert(diaryTable)
      .values({ id, data: item, op: "create", status: "pending", updatedAt: Date.now() })
      .run();

    tx.insert(mutationQueueTable)
      .values({
        entity: "diary",
        payload: {
          op: "create",
          localId: id,
          data: payload,
          clientRequestId,
        } satisfies DiaryMutationPayload,
        createdAt: Date.now(),
      })
      .run();
  });

  return item;
};

export const updateLocal = (
  id: number,
  payload: DiaryFormData,
  currentItem: DiaryRecord | null,
  extras: SynthesizeExtras,
  profile: Profile | null | undefined,
): DiaryRecord => {
  const existingRow = db.select().from(diaryTable).where(eq(diaryTable.id, id)).all()[0];

  const isUnsyncedDraft = id < 0 && existingRow?.op === "create" && existingRow.status !== "synced";

  const base = currentItem ?? (existingRow ? (existingRow.data as DiaryRecord) : null);
  const merged = synthesize(id, base, payload, extras, profile);

  if (isUnsyncedDraft) {
    // Never left the device yet — amend the still-pending create in place
    // instead of queuing a second mutation for the same not-yet-existing diary.
    db.transaction((tx) => {
      tx.update(diaryTable)
        .set({ data: merged, updatedAt: Date.now() })
        .where(eq(diaryTable.id, id))
        .run();

      // Not filtered to status "pending": a create that already failed once
      // (e.g. server-side validation error) sits here with status "error"
      // until explicitly retried — excluding it meant editing a failed draft
      // never updated the queued payload, so retrying kept resending the
      // stale data and reproducing the same error forever.
      const pendingCreate = tx
        .select()
        .from(mutationQueueTable)
        .where(eq(mutationQueueTable.entity, "diary"))
        .all()
        .find(
          (m) =>
            (m.payload as DiaryMutationPayload).op === "create" &&
            (m.payload as DiaryMutationPayload).localId === id,
        );

      if (pendingCreate) {
        const clientRequestId = (pendingCreate.payload as DiaryMutationPayload & {
          op: "create";
        }).clientRequestId;
        tx.update(mutationQueueTable)
          .set({
            payload: {
              op: "create",
              localId: id,
              data: payload,
              clientRequestId,
            } satisfies DiaryMutationPayload,
          })
          .where(eq(mutationQueueTable.id, pendingCreate.id))
          .run();
      }
    });

    return merged;
  }

  db.transaction((tx) => {
    tx.insert(diaryTable)
      .values({ id, data: merged, op: "update", status: "pending", updatedAt: Date.now() })
      .onConflictDoUpdate({
        target: diaryTable.id,
        set: { data: merged, op: "update", status: "pending", lastError: null, updatedAt: Date.now() },
      })
      .run();

    tx.insert(mutationQueueTable)
      .values({
        entity: "diary",
        payload: { op: "update", localId: id, data: payload } satisfies DiaryMutationPayload,
        createdAt: Date.now(),
      })
      .run();
  });

  return merged;
};

export const deleteLocal = (id: number): void => {
  const existingRow = db.select().from(diaryTable).where(eq(diaryTable.id, id)).all()[0];

  const isUnsyncedDraft = id < 0 && existingRow?.op === "create" && existingRow.status !== "synced";

  if (isUnsyncedDraft) {
    db.transaction((tx) => {
      tx.delete(diaryTable).where(eq(diaryTable.id, id)).run();

      tx.select()
        .from(mutationQueueTable)
        .where(eq(mutationQueueTable.entity, "diary"))
        .all()
        .filter((m) => (m.payload as DiaryMutationPayload).localId === id)
        .forEach((m) => tx.delete(mutationQueueTable).where(eq(mutationQueueTable.id, m.id)).run());
    });
    return;
  }

  db.transaction((tx) => {
    const data = existingRow ? (existingRow.data as DiaryRecord) : ({ id } as DiaryRecord);
    tx.insert(diaryTable)
      .values({ id, data, op: "delete", status: "pending", updatedAt: Date.now() })
      .onConflictDoUpdate({
        target: diaryTable.id,
        set: { op: "delete", status: "pending", lastError: null, updatedAt: Date.now() },
      })
      .run();

    tx.insert(mutationQueueTable)
      .values({
        entity: "diary",
        payload: { op: "delete", localId: id } satisfies DiaryMutationPayload,
        createdAt: Date.now(),
      })
      .run();
  });
};

// Called only by the sync engine after a queued create succeeds. Keeps the old
// temp-id row alive as a resolved alias (so a screen still holding the temp id
// in its route params keeps reading successfully, and so resolveDiaryId can
// look up the real id for any observation still referencing this diary by its
// temp id) and writes the canonical row under the real server id.
export const replaceLocalWithServer = (localId: number, serverItem: DiaryItem) => {
  db.transaction((tx) => {
    // Merged over the local record for the reason spelled out on
    // mergedWithLocal — a create response has no is_owner/owner/user_data.
    // Both rows get the same merged item: the real-id row is the one the
    // detail screen reads once it graduates from the temp id.
    const existing = tx.select().from(diaryTable).where(eq(diaryTable.id, localId)).all()[0];
    const data = { ...(existing?.data as DiaryRecord | undefined), ...serverItem };

    const aliasRow = {
      id: localId,
      data,
      op: null,
      status: "synced" as const,
      lastError: null,
      updatedAt: Date.now(),
    };
    tx.insert(diaryTable)
      .values(aliasRow)
      .onConflictDoUpdate({ target: diaryTable.id, set: aliasRow })
      .run();

    const realRow = {
      id: serverItem.id,
      data,
      op: null,
      status: "synced" as const,
      lastError: null,
      updatedAt: Date.now(),
    };
    tx.insert(diaryTable)
      .values(realRow)
      .onConflictDoUpdate({ target: diaryTable.id, set: realRow })
      .run();
  });
};

// Deletes the alias row too, not just the row whose primary key is `id`: once a
// create has synced, the same diary lives under both its temp id and its real
// one (see replaceLocalWithServer), and matching on the primary key alone left
// the temp-id alias behind forever after a delete — an ever-growing pile of
// rows for diaries that no longer exist anywhere.
export const removeLocal = (id: number) => {
  db.delete(diaryTable)
    .where(
      or(eq(diaryTable.id, id), sql`json_extract(${diaryTable.data}, '$.id') = ${id}`),
    )
    .run();
};

// Same atomic claim-and-remove pattern as observationRepository.ts's
// claimNextMutation — see its comment for why this needs to be atomic.
export const claimNextMutation = (): MutationRow | null =>
  db.transaction((tx) => {
    const [row] = tx
      .select()
      .from(mutationQueueTable)
      .where(and(eq(mutationQueueTable.entity, "diary"), eq(mutationQueueTable.status, "pending")))
      .orderBy(asc(mutationQueueTable.createdAt))
      .limit(1)
      .all();

    if (!row) return null;

    tx.delete(mutationQueueTable).where(eq(mutationQueueTable.id, row.id)).run();
    return row;
  });

export const requeuePendingMutation = (
  payload: DiaryMutationPayload,
  createdAt: number,
  attempts: number,
) => {
  db.insert(mutationQueueTable)
    .values({ entity: "diary", payload, createdAt, attempts, status: "pending" })
    .run();
};

export const requeueFailedMutation = (
  payload: DiaryMutationPayload,
  createdAt: number,
  attempts: number,
  localId: number,
  message: string,
) => {
  db.transaction((tx) => {
    tx.insert(mutationQueueTable)
      .values({
        entity: "diary",
        payload,
        createdAt,
        attempts: attempts + 1,
        status: "error",
        lastError: message,
      })
      .run();

    tx.update(diaryTable)
      .set({ status: "error", lastError: message })
      .where(eq(diaryTable.id, localId))
      .run();
  });
};

export const getFailedMutations = (): MutationRow[] =>
  db
    .select()
    .from(mutationQueueTable)
    .where(and(eq(mutationQueueTable.entity, "diary"), eq(mutationQueueTable.status, "error")))
    .orderBy(asc(mutationQueueTable.createdAt))
    .all();

export const getFailedMutationFor = (localId: number): MutationRow | null =>
  getFailedMutations().find((m) => (m.payload as DiaryMutationPayload).localId === localId) ?? null;

export const retryMutation = (mutationId: number, localId: number) => {
  db.transaction((tx) => {
    tx.update(mutationQueueTable)
      .set({ status: "pending", lastError: null })
      .where(eq(mutationQueueTable.id, mutationId))
      .run();

    tx.update(diaryTable)
      .set({ status: "pending", lastError: null })
      .where(eq(diaryTable.id, localId))
      .run();
  });
};

export const discardMutation = (mutationId: number, localId: number) => {
  db.transaction((tx) => {
    tx.delete(mutationQueueTable).where(eq(mutationQueueTable.id, mutationId)).run();
    tx.delete(diaryTable).where(eq(diaryTable.id, localId)).run();
  });
};

interface Overlay {
  pendingCreates: DiaryRecord[];
  patchesById: Map<number, DiaryRecord>;
  deletedIds: Set<number>;
}

export const getOverlay = (): Overlay => {
  const rows = db.select().from(diaryTable).where(isNotNull(diaryTable.op)).all();

  const pendingCreates: DiaryRecord[] = [];
  const patchesById = new Map<number, DiaryRecord>();
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

// A diary card only shows a handful of thumbnails (see DiaryCard.tsx), so cap
// how many locally pending observations we splice into observation_data —
// mirrors whatever cap the server-derived snapshot already came in with.
const MAX_PREVIEW_THUMBS = 5;

// Folds locally pending (not-yet-synced) observations for this diary into its
// card preview: the diary's own observation_data/observation_count is a
// snapshot from the server (or blank for a brand-new offline diary) and never
// reflects an observation created in the same offline session on its own.
// `pendingByDiary` is built once per applyOverlay call (see below) rather
// than re-querying the observation overlay for every diary in the list.
const withPendingObservations = (
  item: DiaryListItem,
  pendingByDiary: Map<number, DiaryListItem["observation_data"][number][]>,
): DiaryListItem => {
  const pending = pendingByDiary.get(item.id);
  if (!pending || pending.length === 0) return item;

  const previewSlots = Math.max(0, MAX_PREVIEW_THUMBS - item.observation_data.length);

  return {
    ...item,
    observation_data: [...pending.slice(0, previewSlots), ...item.observation_data],
    observation_count: item.observation_count + pending.length,
  };
};

const buildPendingByDiaryMap = (): Map<number, DiaryListItem["observation_data"][number][]> => {
  const pendingByDiary = new Map<number, DiaryListItem["observation_data"][number][]>();
  for (const obs of observationRepository.getOverlay().pendingCreates) {
    if (obs.diary == null) continue;
    const preview = {
      species_data: {
        name_lang: obs.species_data.name_lang,
        segment: obs.species_data.segment,
        thumb: obs.species_data.thumb ?? "",
      },
    };
    const list = pendingByDiary.get(obs.diary);
    if (list) list.push(preview);
    else pendingByDiary.set(obs.diary, [preview]);
  }
  return pendingByDiary;
};

// Backs the client-only "unsynced" filter (see util/fetches.ts's
// fetchDiaries). Every row getOverlay() returns already has a queued
// mutation still pending or errored — a successful sync always
// replaceLocalWithServer's/removeLocal's the row — so this is simply all of
// it, with the same pending-observations count folded in as applyOverlay.
export const getUnsyncedItems = (): DiaryListItem[] => {
  const { pendingCreates, patchesById } = getOverlay();
  const pendingByDiary = buildPendingByDiaryMap();
  return [...pendingCreates, ...patchesById.values()].map((item) =>
    withPendingObservations(item, pendingByDiary),
  );
};

export const applyOverlay = (
  response: PaginatedResponse<DiaryListItem>,
  page: number,
): PaginatedResponse<DiaryListItem> => {
  const { pendingCreates, patchesById, deletedIds } = getOverlay();

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

  const pendingByDiary = buildPendingByDiaryMap();
  results = results.map((item) => withPendingObservations(item, pendingByDiary));

  return { ...response, results, pagination: { ...response.pagination, count } };
};

// Same reasoning as observationRepository.clearAllLocal — wipes every
// locally-known diary (synced mirror rows + pending mutations) plus its
// queued mutations, on an account switch rather than ordinary logout.
export const clearAllLocal = () => {
  db.transaction((tx) => {
    tx.delete(diaryTable).run();
    tx.delete(mutationQueueTable).where(eq(mutationQueueTable.entity, "diary")).run();
  });
};
