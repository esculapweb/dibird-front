jest.mock("../referenceRepository", () => ({
  getCachedCountries: jest.fn(() => []),
}));

import { eq } from "drizzle-orm";
import { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { createTestDb, loadRepos } from "../testDb";
import { placeTable, mutationQueueTable } from "../../../services/db/schema";
import * as schema from "../../../services/db/schema";
import {
  ObservationFormData,
  PlaceFormData,
  PlaceItem,
  Profile,
} from "../../../types";

type PlaceRepo = typeof import("../placeRepository");
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

const placePayload = (overrides: Partial<PlaceFormData> = {}): PlaceFormData => ({
  name: "My Place",
  territory: 5,
  favourite: false,
  location: { type: "Point", coordinates: [1, 2] },
  ...overrides,
});

const serverPlace = (overrides: Partial<PlaceItem> = {}): PlaceItem => ({
  id: 555,
  name: "Server Place",
  favourite: false,
  location: { type: "Point", coordinates: [1, 2] },
  distance: null,
  preview: null,
  diary_count: 0,
  observation_count: 0,
  species_count: 0,
  territory: 5,
  territory_data: { code: "", id: 5, name: "", segment: "" },
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

const observationPayload = (
  overrides: Partial<ObservationFormData> = {},
): ObservationFormData => ({
  species: 100,
  territory: 5,
  date_time: "2026-01-01T00:00:00Z",
  location_private: true,
  ...overrides,
});

let db: BetterSQLite3Database<typeof schema>;
let placeRepository: PlaceRepo;
let observationRepository: ObservationRepo;

beforeEach(() => {
  db = createTestDb();
  const repos = loadRepos(db, ["placeRepository", "observationRepository"]);
  placeRepository = repos.placeRepository as PlaceRepo;
  observationRepository = repos.observationRepository as ObservationRepo;
});

const rawRow = (id: number) =>
  db.select().from(placeTable).where(eq(placeTable.id, id)).all()[0];

const mutations = () =>
  db
    .select()
    .from(mutationQueueTable)
    .where(eq(mutationQueueTable.entity, "place"))
    .all();

describe("createLocal", () => {
  it("inserts an op:create/status:pending row and a matching queue entry", () => {
    const item = placeRepository.createLocal(placePayload(), "req-1");

    const row = rawRow(item.id);
    expect(row?.op).toBe("create");
    expect(row?.status).toBe("pending");
    expect(mutations()).toHaveLength(1);
  });
});

describe("updateLocal", () => {
  it("falls back to `base` (not null/default) for every field absent from a bare partial patch", () => {
    placeRepository.upsertFromServer(serverPlace({ name: "Original Name" }));

    const updated = placeRepository.updateLocal(555, { favourite: true }, null);

    expect(updated.favourite).toBe(true);
    expect(updated.name).toBe("Original Name");
    expect(updated.location).toEqual({ type: "Point", coordinates: [1, 2] });
  });

  it("amends an unsynced draft in place, rewriting the pending create's payload to the reduced {name,territory,favourite,location} shape", () => {
    const created = placeRepository.createLocal(placePayload(), "req-1");

    placeRepository.updateLocal(created.id, { favourite: true }, created);

    const row = rawRow(created.id);
    expect(row?.op).toBe("create");
    expect((row?.data as PlaceItem).favourite).toBe(true);

    expect(mutations()).toHaveLength(1);
    expect(mutations()[0].payload).toEqual({
      op: "create",
      localId: created.id,
      data: {
        name: "My Place",
        territory: 5,
        favourite: true,
        location: { type: "Point", coordinates: [1, 2] },
      },
      clientRequestId: "req-1",
    });
  });

  // Regression test: creating a place offline whose name collides with one
  // already on the server fails with a real (non-network) error once synced,
  // leaving the queued create at status "error". Renaming it afterwards must
  // still amend that same queued create (not silently no-op) — otherwise a
  // subsequent retry keeps resending the original stale name and reproduces
  // the same "already exists" error forever.
  it("amends a create that already failed once (status error), not just ones still pending", () => {
    const created = placeRepository.createLocal(placePayload(), "req-1");
    const claimed = placeRepository.claimNextMutation()!;
    placeRepository.requeueFailedMutation(
      claimed.payload as never,
      claimed.createdAt,
      0,
      created.id,
      "Place with this name already exists",
    );
    expect(rawRow(created.id)?.status).toBe("error");

    placeRepository.updateLocal(created.id, { name: "Renamed Place" }, created);

    expect(mutations()).toHaveLength(1);
    expect(mutations()[0].payload).toMatchObject({
      op: "create",
      localId: created.id,
      data: expect.objectContaining({ name: "Renamed Place" }),
    });
  });

  it("enqueues a new update mutation for an already-synced row", () => {
    placeRepository.upsertFromServer(serverPlace());

    placeRepository.updateLocal(555, { favourite: true }, null);

    const row = rawRow(555);
    expect(row?.op).toBe("update");
    expect(mutations()).toHaveLength(1);
    expect(mutations()[0].payload).toMatchObject({ op: "update", localId: 555 });
  });
});

describe("deleteLocal", () => {
  it("deletes an unsynced draft outright and purges its pending queue entry", () => {
    const created = placeRepository.createLocal(placePayload(), "req-1");

    placeRepository.deleteLocal(created.id);

    expect(rawRow(created.id)).toBeUndefined();
    expect(mutations()).toHaveLength(0);
  });

  it("marks a synced row op:delete/status:pending and enqueues a delete mutation", () => {
    placeRepository.upsertFromServer(serverPlace());
    placeRepository.deleteLocal(555);

    const row = rawRow(555);
    expect(row?.op).toBe("delete");
    expect(mutations()).toHaveLength(1);
  });
});

describe("replaceLocalWithServer", () => {
  it("writes both an aliased row at the old temp id and a new row at the server id", () => {
    const created = placeRepository.createLocal(placePayload(), "req-1");

    placeRepository.replaceLocalWithServer(created.id, { ...created, id: 999 });

    expect(rawRow(created.id)?.status).toBe("synced");
    expect(rawRow(999)?.status).toBe("synced");
  });
});

describe("resolvePlaceId", () => {
  it("passes through null/positive ids, resolves a still-pending negative id to itself, and undefined once discarded", () => {
    expect(placeRepository.resolvePlaceId(null)).toBeNull();
    expect(placeRepository.resolvePlaceId(42)).toBe(42);

    const created = placeRepository.createLocal(placePayload(), "req-1");
    expect(placeRepository.resolvePlaceId(created.id)).toBe(created.id);

    expect(placeRepository.resolvePlaceId(-123456)).toBeUndefined();
  });

  // Regression test: a place whose create permanently failed (a real,
  // non-network error) stays in the DB with status "error" rather than being
  // deleted — resolvePlaceId used to return its still-negative id unchanged
  // for this case, indistinguishable from "hasn't synced yet", so an
  // observation/diary referencing it got deferred and retried forever
  // instead of ever being told the place couldn't sync.
  it("resolves to undefined once the place's own create mutation fails for real", () => {
    const created = placeRepository.createLocal(placePayload(), "req-1");
    const claimed = placeRepository.claimNextMutation()!;

    placeRepository.requeueFailedMutation(
      claimed.payload as never,
      claimed.createdAt,
      0,
      created.id,
      "boom",
    );

    expect(placeRepository.resolvePlaceId(created.id)).toBeUndefined();
  });
});

describe("mutation-queue lifecycle", () => {
  it("claimNextMutation removes the oldest pending row; a repeat claim gets the next one, then null", () => {
    placeRepository.createLocal(placePayload(), "req-1");
    placeRepository.createLocal(placePayload(), "req-2");

    const first = placeRepository.claimNextMutation();
    expect((first!.payload as { clientRequestId: string }).clientRequestId).toBe(
      "req-1",
    );
    placeRepository.claimNextMutation();
    expect(placeRepository.claimNextMutation()).toBeNull();
  });

  it("requeueFailedMutation flips the entity row to error; retryMutation clears it again", () => {
    const created = placeRepository.createLocal(placePayload(), "req-1");
    const claimed = placeRepository.claimNextMutation()!;

    placeRepository.requeueFailedMutation(
      claimed.payload as never,
      claimed.createdAt,
      0,
      created.id,
      "boom",
    );
    expect(rawRow(created.id)?.status).toBe("error");

    const [failed] = placeRepository.getFailedMutations();
    placeRepository.retryMutation(failed.id, created.id);
    expect(rawRow(created.id)?.status).toBe("pending");
  });

  it("discardMutation deletes both the queue row and the entity row", () => {
    const created = placeRepository.createLocal(placePayload(), "req-1");
    const [mutation] = mutations();

    placeRepository.discardMutation(mutation.id, created.id);

    expect(rawRow(created.id)).toBeUndefined();
    expect(mutations()).toHaveLength(0);
  });
});

describe("withPendingObservationCount / applyOverlay", () => {
  it("mirrors the backend's non-distinct diary_count and counts distinct species among pending creates, without persisting the adjustment", () => {
    placeRepository.upsertFromServer(serverPlace({ id: 555 }));

    observationRepository.createLocal(
      observationPayload({ place: 555, diary: 7, species: 100 }),
      {},
      PROFILE,
      "obs-1",
    );
    observationRepository.createLocal(
      observationPayload({ place: 555, diary: 8, species: 100 }),
      {},
      PROFILE,
      "obs-2",
    );
    observationRepository.createLocal(
      observationPayload({ place: 555, diary: null, species: 200 }),
      {},
      PROFILE,
      "obs-3",
    );

    const adjusted = placeRepository.withPendingObservationCount(
      placeRepository.getPlace(555)!,
    );

    expect(adjusted.observation_count).toBe(3);
    // Only 2 of the 3 pending observations are diary-scoped.
    expect(adjusted.diary_count).toBe(2);
    // 2 distinct species (100, 200) among the 3 pending observations.
    expect(adjusted.species_count).toBe(2);

    // Must be display-only: the raw stored row is untouched by computing it.
    const rawAfter = rawRow(555);
    expect((rawAfter?.data as PlaceItem).observation_count).toBe(0);
  });

  it("only prepends pending creates on page 1", () => {
    placeRepository.createLocal(placePayload(), "req-1");

    const emptyResponse = () => ({
      results: [],
      pagination: { count: 0, per_page: 20, current: 1, final: 1, next: null, previous: null },
    });

    const page1 = placeRepository.applyOverlay(emptyResponse() as never, 1);
    expect(page1.results).toHaveLength(1);

    const page2 = placeRepository.applyOverlay(emptyResponse() as never, 2);
    expect(page2.results).toHaveLength(0);
  });
});

describe("applyDropdownOverlay", () => {
  it("filters deleted ids and prepends pending-create places matching the given territory", () => {
    placeRepository.upsertFromServer(serverPlace({ id: 601, territory: 5 }));
    placeRepository.deleteLocal(601);

    const created = placeRepository.createLocal(
      placePayload({ territory: 5 }),
      "req-1",
    );
    placeRepository.createLocal(placePayload({ territory: 9 }), "req-2");

    const result = placeRepository.applyDropdownOverlay(
      [{ value: 601, label: "Deleted Place" }],
      5,
    );

    expect(result.find((i) => i.value === 601)).toBeUndefined();
    expect(result.some((i) => i.value === created.id)).toBe(true);
    expect(result).toHaveLength(1);
  });
});

describe("clearAllLocal", () => {
  it("wipes both synced mirror rows and pending mutations, plus their queue entries", () => {
    placeRepository.upsertFromServer(serverPlace({ id: 555 }));
    const created = placeRepository.createLocal(placePayload(), "req-1");

    placeRepository.clearAllLocal();

    expect(rawRow(555)).toBeUndefined();
    expect(rawRow(created.id)).toBeUndefined();
    expect(mutations()).toHaveLength(0);
  });
});
