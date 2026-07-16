import { eq } from "drizzle-orm";
import { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { createTestDb, loadRepos } from "../testDb";
import { mutationQueueTable, notificationReadOverlayTable } from "../../../services/db/schema";
import * as schema from "../../../services/db/schema";
import { PaginatedResponse, AppNotification } from "../../../types";

type NotificationRepo = typeof import("../notificationRepository");

let db: BetterSQLite3Database<typeof schema>;
let notificationRepository: NotificationRepo;

beforeEach(() => {
  db = createTestDb();
  const repos = loadRepos(db, ["notificationRepository"]);
  notificationRepository = repos.notificationRepository as NotificationRepo;
});

const overlayRows = () => db.select().from(notificationReadOverlayTable).all();
const mutations = () =>
  db
    .select()
    .from(mutationQueueTable)
    .where(eq(mutationQueueTable.entity, "notification"))
    .all();

const notification = (overrides: Partial<AppNotification> = {}): AppNotification =>
  ({
    id: 1,
    is_read: false,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  }) as AppNotification;

const page = (results: AppNotification[]): PaginatedResponse<AppNotification> => ({
  results,
  pagination: { count: results.length, per_page: 20, current: 1, final: 1, next: null, previous: null },
});

describe("markIdsReadLocal", () => {
  it("upserts an overlay row per id and enqueues a single markIds mutation", () => {
    notificationRepository.markIdsReadLocal([1, 2]);

    expect(overlayRows().map((r) => r.id).sort()).toEqual([1, 2]);
    const [m] = mutations();
    expect(m.payload).toEqual({ op: "markIds", ids: [1, 2] });
  });

  it("does nothing for an empty id list", () => {
    notificationRepository.markIdsReadLocal([]);
    expect(overlayRows()).toHaveLength(0);
    expect(mutations()).toHaveLength(0);
  });

  it("updates readAt (doesn't duplicate) when the same id is marked twice", () => {
    notificationRepository.markIdsReadLocal([1]);
    notificationRepository.markIdsReadLocal([1]);

    expect(overlayRows()).toHaveLength(1);
    expect(mutations()).toHaveLength(2);
  });
});

describe("markAllReadLocal", () => {
  it("writes the mark-all sentinel row and enqueues a markAll mutation", () => {
    notificationRepository.markAllReadLocal();

    const rows = overlayRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(-1);
    const [m] = mutations();
    expect(m.payload).toEqual({ op: "markAll" });
  });
});

describe("applyOverlay", () => {
  it("returns the response untouched when there's no local overlay at all", () => {
    const response = page([notification({ id: 1, is_read: false })]);
    expect(notificationRepository.applyOverlay(response)).toBe(response);
  });

  it("flips is_read for ids explicitly marked locally", () => {
    notificationRepository.markIdsReadLocal([1]);
    const response = page([
      notification({ id: 1, is_read: false }),
      notification({ id: 2, is_read: false }),
    ]);

    const result = notificationRepository.applyOverlay(response);
    expect(result.results.find((n) => n.id === 1)?.is_read).toBe(true);
    expect(result.results.find((n) => n.id === 2)?.is_read).toBe(false);
  });

  it("does not touch an item that's already read", () => {
    notificationRepository.markIdsReadLocal([1]);
    const original = notification({ id: 1, is_read: true });
    const response = page([original]);

    const result = notificationRepository.applyOverlay(response);
    expect(result.results[0]).toBe(original);
  });

  it("flips is_read for items created at or before the mark-all cutoff", () => {
    const before = Date.parse("2026-01-01T00:00:00Z");
    jest.spyOn(Date, "now").mockReturnValue(before);
    notificationRepository.markAllReadLocal();

    const response = page([
      notification({ id: 1, is_read: false, created_at: "2025-12-31T23:59:59Z" }),
      notification({ id: 2, is_read: false, created_at: "2026-01-02T00:00:00Z" }),
    ]);

    const result = notificationRepository.applyOverlay(response);
    expect(result.results.find((n) => n.id === 1)?.is_read).toBe(true);
    expect(result.results.find((n) => n.id === 2)?.is_read).toBe(false);
    jest.restoreAllMocks();
  });
});

describe("getPendingUnreadAdjustment / applyPendingUnreadAdjustment", () => {
  it("subtracts the count of individually-marked ids still pending sync", () => {
    notificationRepository.markIdsReadLocal([1, 2]);
    expect(notificationRepository.applyPendingUnreadAdjustment(10)).toBe(8);
  });

  it("never goes below zero", () => {
    notificationRepository.markIdsReadLocal([1, 2, 3]);
    expect(notificationRepository.applyPendingUnreadAdjustment(1)).toBe(0);
  });

  it("zeroes out the count entirely when a markAll mutation is still pending", () => {
    notificationRepository.markIdsReadLocal([1]);
    notificationRepository.markAllReadLocal();
    expect(notificationRepository.applyPendingUnreadAdjustment(50)).toBe(0);
  });

  it("leaves the count untouched once nothing is pending", () => {
    expect(notificationRepository.applyPendingUnreadAdjustment(10)).toBe(10);
  });
});

describe("claimNextMutation", () => {
  it("claims and removes the oldest pending notification mutation, in FIFO order", () => {
    notificationRepository.markIdsReadLocal([1]);
    notificationRepository.markIdsReadLocal([2]);

    const first = notificationRepository.claimNextMutation();
    expect(first?.payload).toEqual({ op: "markIds", ids: [1] });
    expect(mutations()).toHaveLength(1);

    const second = notificationRepository.claimNextMutation();
    expect(second?.payload).toEqual({ op: "markIds", ids: [2] });
    expect(mutations()).toHaveLength(0);
  });

  it("returns null once the queue is empty", () => {
    expect(notificationRepository.claimNextMutation()).toBeNull();
  });

  it("ignores mutations belonging to other entities", () => {
    db.insert(mutationQueueTable)
      .values({ entity: "diary", payload: { op: "create" }, createdAt: Date.now() })
      .run();
    expect(notificationRepository.claimNextMutation()).toBeNull();
  });
});

describe("requeuePendingMutation", () => {
  it("re-inserts a claimed mutation back onto the queue with its retry metadata", () => {
    notificationRepository.markIdsReadLocal([1]);
    const claimed = notificationRepository.claimNextMutation()!;

    notificationRepository.requeuePendingMutation(claimed.payload as never, claimed.createdAt, 2);

    const [row] = mutations();
    expect(row.attempts).toBe(2);
    expect(row.status).toBe("pending");
    expect(row.payload).toEqual({ op: "markIds", ids: [1] });
  });
});
