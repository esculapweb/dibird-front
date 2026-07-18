// referenceRepository hits the real db directly (getCachedCountries), so it's
// mocked here exactly as shared.test.ts already does for shared.ts — this
// keeps these tests focused on diaryRepository's own logic without needing a
// country fixture. This is a *static* jest.mock (hoisted, registered once);
// it stays active across the resetModules() calls loadRepos() does per test.
jest.mock("../referenceRepository", () => ({
  getCachedCountries: jest.fn(() => []),
}));

import { eq } from "drizzle-orm";
import { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { createTestDb, loadRepos } from "../testDb";
import { diaryTable, mutationQueueTable } from "../../../services/db/schema";
import * as schema from "../../../services/db/schema";
import { DiaryFormData, ObservationFormData, Profile } from "../../../types";

type DiaryRepo = typeof import("../diaryRepository");
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

const diaryPayload = (overrides: Partial<DiaryFormData> = {}): DiaryFormData => ({
  territory: 5,
  date_time: "2026-01-01T00:00:00Z",
  location_private: true,
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
let diaryRepository: DiaryRepo;
let observationRepository: ObservationRepo;

beforeEach(() => {
  db = createTestDb();
  const repos = loadRepos(db, ["diaryRepository", "observationRepository"]);
  diaryRepository = repos.diaryRepository as DiaryRepo;
  observationRepository = repos.observationRepository as ObservationRepo;
});

const rawDiaryRow = (id: number) =>
  db.select().from(diaryTable).where(eq(diaryTable.id, id)).all()[0];

const pendingCreateMutations = () =>
  db
    .select()
    .from(mutationQueueTable)
    .where(eq(mutationQueueTable.entity, "diary"))
    .all();

describe("createLocal", () => {
  it("inserts an op:create/status:pending row and a matching queue entry", () => {
    const item = diaryRepository.createLocal(
      diaryPayload(),
      {},
      PROFILE,
      "req-1",
    );

    const row = rawDiaryRow(item.id);
    expect(row?.op).toBe("create");
    expect(row?.status).toBe("pending");

    const mutations = pendingCreateMutations();
    expect(mutations).toHaveLength(1);
    expect(mutations[0].payload).toEqual({
      op: "create",
      localId: item.id,
      data: diaryPayload(),
      clientRequestId: "req-1",
    });
  });
});

describe("updateLocal", () => {
  it("amends an unsynced draft in place and rewrites the existing pending create instead of enqueueing a second mutation", () => {
    const created = diaryRepository.createLocal(
      diaryPayload(),
      {},
      PROFILE,
      "req-1",
    );

    diaryRepository.updateLocal(
      created.id,
      diaryPayload({ name: "Updated name" }),
      created,
      {},
      PROFILE,
    );

    const row = rawDiaryRow(created.id);
    expect(row?.op).toBe("create");
    expect((row?.data as { name: string | null }).name).toBe("Updated name");

    const mutations = pendingCreateMutations();
    expect(mutations).toHaveLength(1);
    expect(mutations[0].payload).toEqual({
      op: "create",
      localId: created.id,
      data: diaryPayload({ name: "Updated name" }),
      clientRequestId: "req-1",
    });
  });

  it("enqueues a genuinely new update mutation for an already-synced row", () => {
    diaryRepository.upsertFromServer({
      id: 777,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      date_time: "2026-01-01T00:00:00Z",
      name: null,
      observation_count: 0,
      place: null,
      place_data: null,
      private: false,
      location_private: true,
      profile: 42,
      territory: 5,
      territory_data: { code: "", id: 5, name: "", segment: "" },
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
      user_data: {
        avatar: "",
        first_name: "Jane",
        id: 42,
        last_name: "Doe",
        timezone_id: "",
        username: "jdoe",
      },
    });

    diaryRepository.updateLocal(
      777,
      diaryPayload({ name: "Renamed" }),
      null,
      {},
      PROFILE,
    );

    const row = rawDiaryRow(777);
    expect(row?.op).toBe("update");
    expect(row?.status).toBe("pending");

    const mutations = pendingCreateMutations();
    expect(mutations).toHaveLength(1);
    expect(mutations[0].payload).toMatchObject({ op: "update", localId: 777 });
  });
});

describe("deleteLocal", () => {
  it("deletes an unsynced draft outright and purges its pending queue entry, without enqueueing anything new", () => {
    const created = diaryRepository.createLocal(
      diaryPayload(),
      {},
      PROFILE,
      "req-1",
    );

    diaryRepository.deleteLocal(created.id);

    expect(rawDiaryRow(created.id)).toBeUndefined();
    expect(pendingCreateMutations()).toHaveLength(0);
  });

  it("marks a synced row op:delete/status:pending and enqueues a delete mutation", () => {
    diaryRepository.upsertFromServer({
      id: 888,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      date_time: "2026-01-01T00:00:00Z",
      name: null,
      observation_count: 0,
      place: null,
      place_data: null,
      private: false,
      location_private: true,
      profile: 42,
      territory: 5,
      territory_data: { code: "", id: 5, name: "", segment: "" },
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
      user_data: {
        avatar: "",
        first_name: "Jane",
        id: 42,
        last_name: "Doe",
        timezone_id: "",
        username: "jdoe",
      },
    });

    diaryRepository.deleteLocal(888);

    const row = rawDiaryRow(888);
    expect(row?.op).toBe("delete");
    expect(row?.status).toBe("pending");
    expect(pendingCreateMutations()).toHaveLength(1);
  });
});

describe("replaceLocalWithServer", () => {
  it("writes both an aliased row at the old temp id and a new row at the server id", () => {
    const created = diaryRepository.createLocal(
      diaryPayload(),
      {},
      PROFILE,
      "req-1",
    );

    const serverItem = {
      ...created,
      id: 999,
    };
    diaryRepository.replaceLocalWithServer(created.id, serverItem);

    const aliasRow = rawDiaryRow(created.id);
    expect(aliasRow?.status).toBe("synced");
    expect(aliasRow?.op).toBeNull();
    expect((aliasRow?.data as { id: number }).id).toBe(999);

    const realRow = rawDiaryRow(999);
    expect(realRow?.status).toBe("synced");
    expect((realRow?.data as { id: number }).id).toBe(999);
  });
});

describe("resolveDiaryId", () => {
  it("passes through null and positive ids unchanged", () => {
    expect(diaryRepository.resolveDiaryId(null)).toBeNull();
    expect(diaryRepository.resolveDiaryId(undefined)).toBeUndefined();
    expect(diaryRepository.resolveDiaryId(42)).toBe(42);
  });

  it("returns undefined for a negative id whose local row is gone", () => {
    expect(diaryRepository.resolveDiaryId(-123)).toBeUndefined();
  });

  it("returns local.id for a negative id whose row still exists", () => {
    const created = diaryRepository.createLocal(
      diaryPayload(),
      {},
      PROFILE,
      "req-1",
    );
    expect(diaryRepository.resolveDiaryId(created.id)).toBe(created.id);
  });

  // Regression test: a diary whose create permanently failed (a real,
  // non-network error) stays in the DB with status "error" rather than being
  // deleted — resolveDiaryId used to return its still-negative id unchanged
  // for this case, indistinguishable from "hasn't synced yet", so an
  // observation referencing it got deferred and retried forever instead of
  // ever being told the diary couldn't sync.
  it("returns undefined once the diary's own create mutation fails for real", () => {
    const created = diaryRepository.createLocal(
      diaryPayload(),
      {},
      PROFILE,
      "req-1",
    );
    const claimed = diaryRepository.claimNextMutation()!;

    diaryRepository.requeueFailedMutation(
      claimed.payload as never,
      claimed.createdAt,
      0,
      created.id,
      "boom",
    );

    expect(diaryRepository.resolveDiaryId(created.id)).toBeUndefined();
  });
});

describe("cacheKnownSnapshot", () => {
  it("is a no-op when the existing row already has a pending op set", () => {
    const created = diaryRepository.createLocal(
      diaryPayload(),
      {},
      PROFILE,
      "req-1",
    );

    diaryRepository.cacheKnownSnapshot({ ...created, name: "Should not apply" });

    const row = rawDiaryRow(created.id);
    expect(row?.op).toBe("create");
    expect((row?.data as { name: string | null }).name).not.toBe(
      "Should not apply",
    );
  });
});

describe("mutation-queue lifecycle", () => {
  it("claimNextMutation atomically removes the oldest pending row, then the next claim gets the next one", () => {
    diaryRepository.createLocal(diaryPayload(), {}, PROFILE, "req-1");
    diaryRepository.createLocal(diaryPayload(), {}, PROFILE, "req-2");

    const first = diaryRepository.claimNextMutation();
    expect(first).not.toBeNull();
    expect((first!.payload as { clientRequestId: string }).clientRequestId).toBe(
      "req-1",
    );

    const second = diaryRepository.claimNextMutation();
    expect((second!.payload as { clientRequestId: string }).clientRequestId).toBe(
      "req-2",
    );

    expect(diaryRepository.claimNextMutation()).toBeNull();
  });

  it("requeuePendingMutation preserves createdAt/attempts", () => {
    diaryRepository.createLocal(diaryPayload(), {}, PROFILE, "req-1");
    const claimed = diaryRepository.claimNextMutation()!;

    diaryRepository.requeuePendingMutation(
      claimed.payload as never,
      claimed.createdAt,
      3,
    );

    const [requeued] = pendingCreateMutations();
    expect(requeued.status).toBe("pending");
    expect(requeued.createdAt).toBe(claimed.createdAt);
    expect(requeued.attempts).toBe(3);
  });

  it("requeueFailedMutation flips the entity row to error and re-inserts the queue row with bumped attempts", () => {
    const created = diaryRepository.createLocal(
      diaryPayload(),
      {},
      PROFILE,
      "req-1",
    );
    const claimed = diaryRepository.claimNextMutation()!;

    diaryRepository.requeueFailedMutation(
      claimed.payload as never,
      claimed.createdAt,
      1,
      created.id,
      "boom",
    );

    const [requeued] = pendingCreateMutations();
    expect(requeued.status).toBe("error");
    expect(requeued.attempts).toBe(2);
    expect(requeued.lastError).toBe("boom");

    const row = rawDiaryRow(created.id);
    expect(row?.status).toBe("error");
    expect(row?.lastError).toBe("boom");
  });

  it("getFailedMutations/getFailedMutationFor read back error-state rows", () => {
    const created = diaryRepository.createLocal(
      diaryPayload(),
      {},
      PROFILE,
      "req-1",
    );
    const claimed = diaryRepository.claimNextMutation()!;
    diaryRepository.requeueFailedMutation(
      claimed.payload as never,
      claimed.createdAt,
      0,
      created.id,
      "boom",
    );

    expect(diaryRepository.getFailedMutations()).toHaveLength(1);
    expect(diaryRepository.getFailedMutationFor(created.id)).not.toBeNull();
    expect(diaryRepository.getFailedMutationFor(-1)).toBeNull();
  });

  it("retryMutation flips both rows back to pending and clears the error", () => {
    const created = diaryRepository.createLocal(
      diaryPayload(),
      {},
      PROFILE,
      "req-1",
    );
    const claimed = diaryRepository.claimNextMutation()!;
    diaryRepository.requeueFailedMutation(
      claimed.payload as never,
      claimed.createdAt,
      0,
      created.id,
      "boom",
    );
    const [failed] = diaryRepository.getFailedMutations();

    diaryRepository.retryMutation(failed.id, created.id);

    const [mutation] = pendingCreateMutations();
    expect(mutation.status).toBe("pending");
    expect(mutation.lastError).toBeNull();

    const row = rawDiaryRow(created.id);
    expect(row?.status).toBe("pending");
    expect(row?.lastError).toBeNull();
  });

  it("discardMutation deletes both the queue row and the entity row entirely", () => {
    const created = diaryRepository.createLocal(
      diaryPayload(),
      {},
      PROFILE,
      "req-1",
    );
    const [mutation] = pendingCreateMutations();

    diaryRepository.discardMutation(mutation.id, created.id);

    expect(rawDiaryRow(created.id)).toBeUndefined();
    expect(pendingCreateMutations()).toHaveLength(0);
  });
});

describe("applyOverlay", () => {
  const emptyResponse = () => ({
    results: [],
    pagination: { count: 0, per_page: 20, current: 1, final: 1, next: null, previous: null },
  });

  it("only prepends pending creates on page 1", () => {
    diaryRepository.createLocal(diaryPayload(), {}, PROFILE, "req-1");

    const page1 = diaryRepository.applyOverlay(emptyResponse(), 1);
    expect(page1.results).toHaveLength(1);
    expect(page1.pagination.count).toBe(1);

    const page2 = diaryRepository.applyOverlay(emptyResponse(), 2);
    expect(page2.results).toHaveLength(0);
  });

  it("filters out deleted ids and applies patches from the overlay", () => {
    diaryRepository.upsertFromServer({
      id: 111,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      date_time: "2026-01-01T00:00:00Z",
      name: "Original",
      observation_count: 0,
      place: null,
      place_data: null,
      private: false,
      location_private: true,
      profile: 42,
      territory: 5,
      territory_data: { code: "", id: 5, name: "", segment: "" },
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
      user_data: {
        avatar: "",
        first_name: "Jane",
        id: 42,
        last_name: "Doe",
        timezone_id: "",
        username: "jdoe",
      },
    });
    diaryRepository.updateLocal(111, diaryPayload({ name: "Patched" }), null, {}, PROFILE);

    const response = {
      results: [
        {
          id: 111,
          date_time: "2026-01-01T00:00:00Z",
          name: "Original",
          observation_count: 0,
          place: null,
          place_data: null,
          private: false,
          location_private: true,
          profile: 42,
          territory: 5,
          territory_data: { code: "", id: 5, name: "", segment: "" },
        },
      ],
      pagination: { count: 1, per_page: 20, current: 1, final: 1, next: null, previous: null },
    };

    const result = diaryRepository.applyOverlay(response as never, 1);
    expect((result.results[0] as { name: string | null }).name).toBe("Patched");
  });

  it("splices pending observations into the diary preview, capping observation_data at 5 while still counting the full pending total", () => {
    const diary = diaryRepository.createLocal(diaryPayload(), {}, PROFILE, "req-1");

    for (let i = 0; i < 7; i++) {
      observationRepository.createLocal(
        observationPayload({ diary: diary.id }),
        {},
        PROFILE,
        `obs-req-${i}`,
      );
    }

    const response = {
      results: [],
      pagination: { count: 0, per_page: 20, current: 1, final: 1, next: null, previous: null },
    };
    const result = diaryRepository.applyOverlay(response as never, 1);

    const spliced = result.results.find((item) => item.id === diary.id)!;
    expect(spliced.observation_data.length).toBe(5);
    expect(spliced.observation_count).toBe(7);
  });
});

describe("getUnsyncedItems", () => {
  it("returns pending creates plus patched/errored rows, but not synced ones", () => {
    diaryRepository.upsertFromServer({
      id: 111,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      date_time: "2026-01-01T00:00:00Z",
      name: "Original",
      observation_count: 0,
      place: null,
      place_data: null,
      private: false,
      location_private: true,
      profile: 42,
      territory: 5,
      territory_data: { code: "", id: 5, name: "", segment: "" },
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
      user_data: {
        avatar: "",
        first_name: "Jane",
        id: 42,
        last_name: "Doe",
        timezone_id: "",
        username: "jdoe",
      },
    });
    diaryRepository.updateLocal(111, diaryPayload({ name: "Patched" }), null, {}, PROFILE);
    const created = diaryRepository.createLocal(diaryPayload(), {}, PROFILE, "req-1");

    const items = diaryRepository.getUnsyncedItems();

    expect(items.map((item) => item.id).sort()).toEqual([111, created.id].sort());
    expect(items.find((item) => item.id === 111)?._pendingSync).toBe("pending");
  });

  it("folds in pending observations the same way applyOverlay does", () => {
    const diary = diaryRepository.createLocal(diaryPayload(), {}, PROFILE, "req-1");
    observationRepository.createLocal(
      observationPayload({ diary: diary.id }),
      {},
      PROFILE,
      "obs-req-1",
    );

    const [item] = diaryRepository.getUnsyncedItems();
    expect(item.observation_count).toBe(1);
  });
});

describe("clearAllLocal", () => {
  it("wipes both synced mirror rows and pending mutations, plus their queue entries", () => {
    diaryRepository.upsertFromServer({
      id: 888,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      date_time: "2026-01-01T00:00:00Z",
      name: null,
      observation_count: 0,
      place: null,
      place_data: null,
      private: false,
      location_private: true,
      profile: 42,
      territory: 5,
      territory_data: { code: "", id: 5, name: "", segment: "" },
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
      user_data: {
        avatar: "",
        first_name: "Jane",
        id: 42,
        last_name: "Doe",
        timezone_id: "",
        username: "jdoe",
      },
    });
    const created = diaryRepository.createLocal(diaryPayload(), {}, PROFILE, "req-1");

    diaryRepository.clearAllLocal();

    expect(rawDiaryRow(888)).toBeUndefined();
    expect(rawDiaryRow(created.id)).toBeUndefined();
    expect(pendingCreateMutations()).toHaveLength(0);
  });
});
