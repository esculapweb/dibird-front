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
