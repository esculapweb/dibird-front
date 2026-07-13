import { eq } from "drizzle-orm";
import { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { createTestDb, loadRepos } from "../testDb";
import { alertSettingsTable, mutationQueueTable } from "../../../services/db/schema";
import * as schema from "../../../services/db/schema";
import { AlertSettings } from "../../../services/alertSettings";

type AlertSettingsRepo = typeof import("../alertSettingsRepository");

const SERVER_SETTINGS: AlertSettings = {
  id: 1,
  location_lat: 10,
  location_lon: 20,
  territory_data: { code: "", id: 5, name: "", segment: "" },
  radius_km: 25,
  rarity_threshold: "rare",
  language: "en",
  seen_mode: "year",
  watchlist_only: false,
  include_local_observations: true,
  active_hours_utc: [[0, 23]],
  max_alerts_per_day: 5,
  is_enabled: true,
  updated_at: "2026-01-01T00:00:00Z",
};

let db: BetterSQLite3Database<typeof schema>;
let alertSettingsRepository: AlertSettingsRepo;

beforeEach(() => {
  db = createTestDb();
  const repos = loadRepos(db, ["alertSettingsRepository"]);
  alertSettingsRepository = repos.alertSettingsRepository as AlertSettingsRepo;
});

const rawRow = () => db.select().from(alertSettingsTable).all()[0];

const mutations = () =>
  db
    .select()
    .from(mutationQueueTable)
    .where(eq(mutationQueueTable.entity, "alertSettings"))
    .all();

describe("applyLocalPatch", () => {
  it("merges the patch over the existing row's data and enqueues a mutation", () => {
    alertSettingsRepository.upsertFromServer(SERVER_SETTINGS);

    alertSettingsRepository.applyLocalPatch({ radius_km: 50 }, true);

    const row = rawRow();
    expect(row?.status).toBe("pending");
    expect((row?.data as AlertSettings).radius_km).toBe(50);
    // Untouched fields survive the merge.
    expect((row?.data as AlertSettings).rarity_threshold).toBe("rare");
    expect(mutations()).toHaveLength(1);
  });

  // No `.where()` and no upsert on the settings row's UPDATE — verified
  // directly here rather than assumed, since it's easy to expect an
  // insert-if-missing fallback that this function doesn't actually have.
  // If applyLocalPatch is ever called before any settings row exists (no
  // server fetch has happened yet), the UPDATE affects zero rows: the
  // mutation still gets queued, but the settings row itself is never
  // created. A caller relying on the settings row existing after this call
  // would find nothing.
  it("KNOWN GAP: queues the mutation but does not create the settings row if none exists yet", () => {
    alertSettingsRepository.applyLocalPatch({ radius_km: 50 }, true);

    expect(rawRow()).toBeUndefined();
    expect(mutations()).toHaveLength(1);
  });

  it("enqueues a second, independent mutation on a second call while the first is still pending (unlike diary/observation/place, which collapse a second edit into the still-pending create)", () => {
    alertSettingsRepository.upsertFromServer(SERVER_SETTINGS);

    alertSettingsRepository.applyLocalPatch({ radius_km: 50 }, true);
    alertSettingsRepository.applyLocalPatch({ is_enabled: false }, true);

    expect(mutations()).toHaveLength(2);
    const row = rawRow();
    expect((row?.data as AlertSettings).radius_km).toBe(50);
    expect((row?.data as AlertSettings).is_enabled).toBe(false);
  });
});

describe("getPendingMutations / getFailedMutations", () => {
  it("reads back mutations filtered by status", () => {
    alertSettingsRepository.upsertFromServer(SERVER_SETTINGS);
    alertSettingsRepository.applyLocalPatch({ radius_km: 50 }, true);

    expect(alertSettingsRepository.getPendingMutations()).toHaveLength(1);
    expect(alertSettingsRepository.getFailedMutations()).toHaveLength(0);
  });
});

describe("failMutation", () => {
  it("bumps attempts via the raw sql expression and marks both rows error", () => {
    alertSettingsRepository.upsertFromServer(SERVER_SETTINGS);
    alertSettingsRepository.applyLocalPatch({ radius_km: 50 }, true);
    const [pending] = alertSettingsRepository.getPendingMutations();

    alertSettingsRepository.failMutation(pending.id, "boom");
    alertSettingsRepository.failMutation(pending.id, "boom again");

    const failed = alertSettingsRepository.getFailedMutations();
    expect(failed).toHaveLength(1);
    expect(failed[0].attempts).toBe(2);
    expect(failed[0].lastError).toBe("boom again");
    expect(rawRow()?.status).toBe("error");
  });
});

describe("retryMutation", () => {
  it("flips both the queue row and the settings row back to pending", () => {
    alertSettingsRepository.upsertFromServer(SERVER_SETTINGS);
    alertSettingsRepository.applyLocalPatch({ radius_km: 50 }, true);
    const [pending] = alertSettingsRepository.getPendingMutations();
    alertSettingsRepository.failMutation(pending.id, "boom");
    const [failed] = alertSettingsRepository.getFailedMutations();

    alertSettingsRepository.retryMutation(failed.id);

    expect(rawRow()?.status).toBe("pending");
    expect(alertSettingsRepository.getPendingMutations()).toHaveLength(1);
  });
});

describe("discardMutation vs. resolveMutation: known inconsistency", () => {
  it("discardMutation checks for other remaining pending mutations before deciding the settings row's resulting status", () => {
    alertSettingsRepository.upsertFromServer(SERVER_SETTINGS);
    alertSettingsRepository.applyLocalPatch({ radius_km: 50 }, true);
    alertSettingsRepository.applyLocalPatch({ is_enabled: false }, true);
    const [first, second] = alertSettingsRepository.getPendingMutations();

    alertSettingsRepository.discardMutation(first.id);
    // The second mutation is still pending, so the settings row must stay pending too.
    expect(rawRow()?.status).toBe("pending");

    alertSettingsRepository.discardMutation(second.id);
    // Nothing left pending now — settings row goes back to synced.
    expect(rawRow()?.status).toBe("synced");
  });

  // KNOWN INCONSISTENCY: unlike discardMutation just above, resolveMutation
  // marks the settings row "synced" unconditionally, without checking
  // whether another alertSettings mutation is still pending. This documents
  // current behavior, not the intended contract — a deliberate future fix
  // should update this test, not be surprised by it.
  it("KNOWN INCONSISTENCY: resolveMutation marks the settings row synced unconditionally, even with another mutation still pending", () => {
    alertSettingsRepository.upsertFromServer(SERVER_SETTINGS);
    alertSettingsRepository.applyLocalPatch({ radius_km: 50 }, true);
    alertSettingsRepository.applyLocalPatch({ is_enabled: false }, true);
    const [first] = alertSettingsRepository.getPendingMutations();

    alertSettingsRepository.resolveMutation(first.id);

    expect(alertSettingsRepository.getPendingMutations()).toHaveLength(1);
    // The row is marked synced even though a second mutation is still pending.
    expect(rawRow()?.status).toBe("synced");
  });
});

describe("clearAlertSettings", () => {
  it("wipes both the settings row and its queue entries", () => {
    alertSettingsRepository.upsertFromServer(SERVER_SETTINGS);
    alertSettingsRepository.applyLocalPatch({ radius_km: 50 }, true);

    alertSettingsRepository.clearAlertSettings();

    expect(rawRow()).toBeUndefined();
    expect(mutations()).toHaveLength(0);
  });
});
