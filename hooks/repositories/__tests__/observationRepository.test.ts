jest.mock("../referenceRepository", () => ({
  getCachedCountries: jest.fn(() => []),
}));

import { eq } from "drizzle-orm";
import { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { createTestDb, loadRepos } from "../testDb";
import { observationTable, mutationQueueTable } from "../../../services/db/schema";
import * as schema from "../../../services/db/schema";
import { ObservationFormData, ObservationItem, Profile } from "../../../types";

type ObservationRepo = typeof import("../observationRepository");

const PROFILE: Profile = {
  user_data: {
    username: "jdoe",
    first_name: "Jane",
    last_name: "Doe",
    email: "jane@example.com",
    is_active: true,
  },
  avatar: "",
  avatar_thumbnail: "",
  private: false,
  private_diary: false,
  user: 42,
  registration_ip: "",
  timezone: "Europe/Berlin",
  territory: 5,
};

const observationPayload = (
  overrides: Partial<ObservationFormData> = {},
): ObservationFormData => ({
  species: 100,
  territory: 5,
  date_time: "2026-01-01T00:00:00Z",
  location_private: true,
  ...overrides,
});

const serverObservation = (overrides: Partial<ObservationItem> = {}): ObservationItem => ({
  id: 555,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  date_time: "2026-01-01T00:00:00Z",
  diary: null,
  is_owner: true,
  owner: {
    avatar: "",
    first_name: "Jane",
    id: 42,
    last_name: "Doe",
    private: false,
    timezone_id: "",
    username: "jdoe",
  },
  notes: null,
  quantity: null,
  time: null,
  place: null,
  place_data: null,
  private: false,
  species: 100,
  species_data: { id: 100, name: "", name_lang: "", segment: "", thumb: null },
  territory: 5,
  territory_data: { code: "", id: 5, name: "", segment: "" },
  location_private: true,
  external_source: null,
  external_username: null,
  ...overrides,
});

let db: BetterSQLite3Database<typeof schema>;
let observationRepository: ObservationRepo;

beforeEach(() => {
  db = createTestDb();
  const repos = loadRepos(db, ["observationRepository"]);
  observationRepository = repos.observationRepository as ObservationRepo;
});

const rawRow = (id: number) =>
  db.select().from(observationTable).where(eq(observationTable.id, id)).all()[0];

const mutations = () =>
  db
    .select()
    .from(mutationQueueTable)
    .where(eq(mutationQueueTable.entity, "observation"))
    .all();

describe("createLocal / updateLocal", () => {
  it("inserts an op:create/status:pending row with a matching queue entry", () => {
    const item = observationRepository.createLocal(
      observationPayload(),
      {},
      PROFILE,
      "req-1",
    );

    const row = rawRow(item.id);
    expect(row?.op).toBe("create");
    expect(row?.status).toBe("pending");
    expect(mutations()).toHaveLength(1);
  });

  it("amends an unsynced draft in place, rewriting the pending create rather than enqueueing a second mutation", () => {
    const created = observationRepository.createLocal(
      observationPayload(),
      {},
      PROFILE,
      "req-1",
    );

    observationRepository.updateLocal(
      created.id,
      observationPayload({ notes: "Updated" }),
      created,
      {},
      PROFILE,
    );

    const row = rawRow(created.id);
    expect(row?.op).toBe("create");
    expect((row?.data as { notes: string | null }).notes).toBe("Updated");
    expect(mutations()).toHaveLength(1);
    expect(mutations()[0].payload).toMatchObject({
      op: "create",
      localId: created.id,
      clientRequestId: "req-1",
    });
  });

  it("enqueues a new update mutation for an already-synced row", () => {
    observationRepository.upsertFromServer(serverObservation());

    observationRepository.updateLocal(
      555,
      observationPayload({ notes: "Renamed" }),
      null,
      {},
      PROFILE,
    );

    const row = rawRow(555);
    expect(row?.op).toBe("update");
    expect(mutations()).toHaveLength(1);
    expect(mutations()[0].payload).toMatchObject({ op: "update", localId: 555 });
  });

  it("fills a diary-scoped observation's territory/place/date_time/private from SynthesizeExtras when the payload omits them", () => {
    const item = observationRepository.createLocal(
      {
        species: 100,
        location_private: true,
        diary: 7,
      },
      {
        diaryTerritory: 9,
        diaryPlace: 21,
        diaryDateTime: "2025-06-01T00:00:00Z",
        diaryPrivate: true,
      },
      PROFILE,
      "req-1",
    );

    expect(item.territory).toBe(9);
    expect(item.place).toBe(21);
    expect(item.date_time).toBe("2025-06-01T00:00:00Z");
    expect(item.private).toBe(true);

    const readBack = observationRepository.getObservation(item.id)!;
    expect(readBack.territory).toBe(9);
    expect(readBack.place).toBe(21);
  });
});

describe("deleteLocal", () => {
  it("deletes an unsynced draft outright and purges its pending queue entry", () => {
    const created = observationRepository.createLocal(
      observationPayload(),
      {},
      PROFILE,
      "req-1",
    );

    observationRepository.deleteLocal(created.id);

    expect(rawRow(created.id)).toBeUndefined();
    expect(mutations()).toHaveLength(0);
  });

  it("marks a synced row op:delete/status:pending and enqueues a delete mutation", () => {
    observationRepository.upsertFromServer(serverObservation());
    observationRepository.deleteLocal(555);

    const row = rawRow(555);
    expect(row?.op).toBe("delete");
    expect(row?.status).toBe("pending");
    expect(mutations()).toHaveLength(1);
  });
});

describe("replaceLocalWithServer", () => {
  it("writes both an aliased row at the old temp id and a new row at the server id", () => {
    const created = observationRepository.createLocal(
      observationPayload(),
      {},
      PROFILE,
      "req-1",
    );

    observationRepository.replaceLocalWithServer(created.id, {
      ...created,
      id: 999,
    });

    const alias = rawRow(created.id);
    expect(alias?.status).toBe("synced");
    expect((alias?.data as { id: number }).id).toBe(999);

    const real = rawRow(999);
    expect(real?.status).toBe("synced");
  });
});

describe("mutation-queue lifecycle", () => {
  it("claimNextMutation removes the oldest pending row; a repeat claim gets the next one, then null", () => {
    observationRepository.createLocal(observationPayload(), {}, PROFILE, "req-1");
    observationRepository.createLocal(observationPayload(), {}, PROFILE, "req-2");

    const first = observationRepository.claimNextMutation();
    expect((first!.payload as { clientRequestId: string }).clientRequestId).toBe(
      "req-1",
    );
    const second = observationRepository.claimNextMutation();
    expect((second!.payload as { clientRequestId: string }).clientRequestId).toBe(
      "req-2",
    );
    expect(observationRepository.claimNextMutation()).toBeNull();
  });

  it("requeueFailedMutation flips the entity row to error and bumps attempts", () => {
    const created = observationRepository.createLocal(
      observationPayload(),
      {},
      PROFILE,
      "req-1",
    );
    const claimed = observationRepository.claimNextMutation()!;

    observationRepository.requeueFailedMutation(
      claimed.payload as never,
      claimed.createdAt,
      1,
      created.id,
      "boom",
    );

    expect(mutations()[0].status).toBe("error");
    expect(mutations()[0].attempts).toBe(2);
    expect(rawRow(created.id)?.status).toBe("error");
  });

  it("retryMutation clears the error on both rows", () => {
    const created = observationRepository.createLocal(
      observationPayload(),
      {},
      PROFILE,
      "req-1",
    );
    const claimed = observationRepository.claimNextMutation()!;
    observationRepository.requeueFailedMutation(
      claimed.payload as never,
      claimed.createdAt,
      0,
      created.id,
      "boom",
    );
    const [failed] = observationRepository.getFailedMutations();

    observationRepository.retryMutation(failed.id, created.id);

    expect(mutations()[0].status).toBe("pending");
    expect(rawRow(created.id)?.status).toBe("pending");
  });

  it("discardMutation deletes both the queue row and the entity row", () => {
    const created = observationRepository.createLocal(
      observationPayload(),
      {},
      PROFILE,
      "req-1",
    );
    const [mutation] = mutations();

    observationRepository.discardMutation(mutation.id, created.id);

    expect(rawRow(created.id)).toBeUndefined();
    expect(mutations()).toHaveLength(0);
  });
});

describe("applyOverlay", () => {
  const emptyResponse = () => ({
    results: [],
    pagination: { count: 0, per_page: 20, current: 1, final: 1, next: null, previous: null },
  });

  it("only prepends pending creates on page 1", () => {
    observationRepository.createLocal(observationPayload(), {}, PROFILE, "req-1");

    const page1 = observationRepository.applyOverlay(emptyResponse() as never, 1);
    expect(page1.results).toHaveLength(1);
    expect(page1.pagination.count).toBe(1);

    const page2 = observationRepository.applyOverlay(emptyResponse() as never, 2);
    expect(page2.results).toHaveLength(0);
  });
});

describe("getUnsyncedItems", () => {
  it("returns pending creates plus patched/errored rows, but not synced ones", () => {
    observationRepository.upsertFromServer(serverObservation({ id: 555 }));
    observationRepository.updateLocal(555, observationPayload({ notes: "Patched" }), null, {}, PROFILE);
    const created = observationRepository.createLocal(
      observationPayload(),
      {},
      PROFILE,
      "req-1",
    );

    const items = observationRepository.getUnsyncedItems();

    expect(items.map((item) => item.id).sort()).toEqual([555, created.id].sort());
    expect(items.find((item) => item.id === 555)?._pendingSync).toBe("pending");
  });

  it("returns nothing once every local mutation has synced", () => {
    observationRepository.upsertFromServer(serverObservation({ id: 555 }));
    expect(observationRepository.getUnsyncedItems()).toEqual([]);
  });
});

describe("applyDiaryOverlay", () => {
  const pageResponse = (results: ObservationItem[], count: number) => ({
    results,
    pagination: { count, per_page: 20, current: 1, final: 2, next: 2, previous: null },
  });

  it("filters to the given diaryId and reshapes through toDiaryObservationItem", () => {
    observationRepository.createLocal(
      observationPayload({ diary: 7 }),
      {},
      PROFILE,
      "req-1",
    );
    observationRepository.createLocal(
      observationPayload({ diary: 8 }),
      {},
      PROFILE,
      "req-2",
    );

    const result = observationRepository.applyDiaryOverlay(
      pageResponse([], 0) as never,
      7,
      1,
    );

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).not.toHaveProperty("territory");
    expect(result.results[0]).toHaveProperty("species_data");
  });

  it("subtracts only this page's deleted count (deletedInPage), not the global deletedIds size, from the total", () => {
    // 2 observations already synced and shown on page 1, both then deleted
    // locally; 3 more synced+deleted observations exist but surface on a
    // different page. With only one page, deletedInPage.length would always
    // equal deletedIds.size, so this needs both to diverge to be meaningful.
    const page1Deleted = [
      serverObservation({ id: 201, diary: 7 }),
      serverObservation({ id: 202, diary: 7 }),
    ];
    const page2Deleted = [
      serverObservation({ id: 301, diary: 7 }),
      serverObservation({ id: 302, diary: 7 }),
      serverObservation({ id: 303, diary: 7 }),
    ];
    for (const obs of [...page1Deleted, ...page2Deleted]) {
      observationRepository.upsertFromServer(obs);
      observationRepository.deleteLocal(obs.id);
    }

    const page1Response = pageResponse(page1Deleted, 10);
    const result = observationRepository.applyDiaryOverlay(
      page1Response as never,
      7,
      1,
    );

    expect(result.results).toHaveLength(0);
    // Only this page's 2 deleted items are subtracted, not the global 5.
    expect(result.pagination.count).toBe(8);
  });
});

describe("getPendingSpeciesForDiary", () => {
  it("collects species from pending creates and patched-in updates for the given diary", () => {
    observationRepository.createLocal(
      observationPayload({ diary: 7, species: 100 }),
      {},
      PROFILE,
      "req-1",
    );
    observationRepository.createLocal(
      observationPayload({ diary: 8, species: 200 }),
      {},
      PROFILE,
      "req-2",
    );
    observationRepository.upsertFromServer(serverObservation({ id: 555, diary: 7, species: 300 }));
    observationRepository.updateLocal(
      555,
      observationPayload({ diary: 7, species: 301 }),
      null,
      {},
      PROFILE,
    );

    const result = observationRepository.getPendingSpeciesForDiary(7);

    expect(result).toEqual(new Set([100, 301]));
  });

  it("excludes the given observation id, so editing it doesn't disable its own species", () => {
    const created = observationRepository.createLocal(
      observationPayload({ diary: 7, species: 100 }),
      {},
      PROFILE,
      "req-1",
    );

    const result = observationRepository.getPendingSpeciesForDiary(7, created.id);

    expect(result.size).toBe(0);
  });

  it("returns an empty set once a pending create is deleted before it ever synced", () => {
    const created = observationRepository.createLocal(
      observationPayload({ diary: 7, species: 100 }),
      {},
      PROFILE,
      "req-1",
    );
    observationRepository.deleteLocal(created.id);

    expect(observationRepository.getPendingSpeciesForDiary(7)).toEqual(new Set());
  });
});

describe("clearAllLocal", () => {
  it("wipes both synced mirror rows and pending mutations, plus their queue entries", () => {
    observationRepository.upsertFromServer(serverObservation({ id: 555 }));
    const created = observationRepository.createLocal(
      observationPayload(),
      {},
      PROFILE,
      "req-1",
    );

    observationRepository.clearAllLocal();

    expect(rawRow(555)).toBeUndefined();
    expect(rawRow(created.id)).toBeUndefined();
    expect(mutations()).toHaveLength(0);
  });
});

describe("makeClientRequestId", () => {
  // Idempotency key for create: the server dedupes on it, so two calls must
  // never collide.
  it("hands out a distinct id every time", () => {
    const ids = new Set(
      Array.from({ length: 50 }, () => observationRepository.makeClientRequestId()),
    );

    expect(ids.size).toBe(50);
  });
});

describe("removeLocal", () => {
  it("drops the mirror row outright", () => {
    observationRepository.upsertFromServer(serverObservation({ id: 555 }));

    observationRepository.removeLocal(555);

    expect(rawRow(555)).toBeUndefined();
  });
});

describe("getFailedMutationFor", () => {
  it("finds the failed mutation belonging to one local row", () => {
    const created = observationRepository.createLocal(
      observationPayload(),
      {},
      PROFILE,
      "req-1",
    );
    const claimed = observationRepository.claimNextMutation()!;
    observationRepository.requeueFailedMutation(
      claimed.payload as never,
      claimed.createdAt,
      claimed.attempts,
      created.id,
      "server said no",
    );

    const failed = observationRepository.getFailedMutationFor(created.id);

    expect(failed?.lastError).toBe("server said no");
  });

  it("returns null for a row with nothing failed against it", () => {
    observationRepository.createLocal(observationPayload(), {}, PROFILE, "req-1");

    expect(observationRepository.getFailedMutationFor(-999)).toBeNull();
  });
});

describe("requeuePendingMutation", () => {
  // A network failure must not burn an attempt or jump the queue: the row
  // goes back with its original createdAt and attempt count.
  it("puts a claimed mutation back with its ordering and attempts intact", () => {
    observationRepository.createLocal(observationPayload(), {}, PROFILE, "req-1");
    const claimed = observationRepository.claimNextMutation()!;
    expect(mutations()).toHaveLength(0);

    observationRepository.requeuePendingMutation(
      claimed.payload as never,
      claimed.createdAt,
      3,
    );

    const [requeued] = mutations();
    expect(requeued.status).toBe("pending");
    expect(requeued.attempts).toBe(3);
    expect(requeued.createdAt).toBe(claimed.createdAt);
  });
});

describe("getOverlay for a delete that failed to sync", () => {
  // A failed delete is shown back in the list with an error badge rather than
  // silently disappearing — unlike a still-pending one, which is hidden.
  it("keeps the row visible as a patch instead of hiding it", () => {
    observationRepository.upsertFromServer(serverObservation({ id: 555 }));
    observationRepository.deleteLocal(555);
    const claimed = observationRepository.claimNextMutation()!;
    observationRepository.requeueFailedMutation(
      claimed.payload as never,
      claimed.createdAt,
      claimed.attempts,
      555,
      "server said no",
    );

    const { deletedIds, patchesById } = observationRepository.getOverlay();

    expect(deletedIds.has(555)).toBe(false);
    expect(patchesById.get(555)?._pendingSync).toBe("error");
    expect(patchesById.get(555)?._syncError).toBe("server said no");
  });
});

describe("applyOverlay merging into a server page", () => {
  const pageOf = (results: ObservationItem[], count: number) => ({
    results,
    pagination: { count, per_page: 20, current: 1, final: 1, next: null, previous: null },
  });

  it("returns the response untouched when there is nothing local to merge", () => {
    const response = pageOf([serverObservation({ id: 555 })], 1);

    const result = observationRepository.applyOverlay(response as never, 1);

    expect(result).toBe(response);
  });

  it("hides locally deleted rows and subtracts them from the total", () => {
    observationRepository.upsertFromServer(serverObservation({ id: 555 }));
    observationRepository.deleteLocal(555);

    const result = observationRepository.applyOverlay(
      pageOf([serverObservation({ id: 555 })], 10) as never,
      1,
    );

    expect(result.results).toHaveLength(0);
    expect(result.pagination.count).toBe(9);
  });

  it("swaps a server row for its locally patched version", () => {
    observationRepository.upsertFromServer(serverObservation({ id: 555 }));
    observationRepository.updateLocal(
      555,
      observationPayload({ notes: "Patched" }),
      null,
      {},
      PROFILE,
    );

    const result = observationRepository.applyOverlay(
      pageOf([serverObservation({ id: 555, notes: "From server" })], 1) as never,
      1,
    );

    expect(result.results[0].notes).toBe("Patched");
    expect(result.results[0]._pendingSync).toBe("pending");
  });

  it("does not prepend a pending create the server already returned", () => {
    const created = observationRepository.createLocal(
      observationPayload(),
      {},
      PROFILE,
      "req-1",
    );

    const result = observationRepository.applyOverlay(
      pageOf([serverObservation({ id: created.id })], 1) as never,
      1,
    );

    expect(result.results).toHaveLength(1);
    expect(result.pagination.count).toBe(1);
  });
});

describe("applyDiaryOverlay short-circuits", () => {
  const pageOf = (count: number) => ({
    results: [],
    pagination: { count, per_page: 20, current: 1, final: 1, next: null, previous: null },
  });

  it("leaves the response alone when the list is not diary-scoped", () => {
    observationRepository.createLocal(
      observationPayload({ diary: 7 }),
      {},
      PROFILE,
      "req-1",
    );
    const response = pageOf(0);

    expect(observationRepository.applyDiaryOverlay(response as never, null, 1)).toBe(
      response,
    );
  });

  it("leaves the response alone when nothing local belongs to this diary", () => {
    observationRepository.createLocal(
      observationPayload({ diary: 8 }),
      {},
      PROFILE,
      "req-1",
    );
    const response = pageOf(0);

    expect(observationRepository.applyDiaryOverlay(response as never, 7, 1)).toBe(
      response,
    );
  });

  it("reshapes a patched row of this diary into a DiaryObservationItem", () => {
    observationRepository.upsertFromServer(serverObservation({ id: 555, diary: 7 }));
    observationRepository.updateLocal(
      555,
      observationPayload({ diary: 7, notes: "Patched" }),
      null,
      {},
      PROFILE,
    );

    const result = observationRepository.applyDiaryOverlay(
      {
        results: [{ id: 555, notes: "From server" }],
        pagination: { count: 1, per_page: 20, current: 1, final: 1, next: null, previous: null },
      } as never,
      7,
      1,
    );

    expect(result.results[0].notes).toBe("Patched");
    expect(result.results[0]).not.toHaveProperty("territory");
  });
});
