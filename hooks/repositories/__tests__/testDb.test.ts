import { eq } from "drizzle-orm";

import { createTestDb } from "../testDb";
import { diaryTable } from "../../../services/db/schema";

// Isolates infra failures (broken migration/driver wiring) from repository
// logic failures in the other test files — if this fails, the problem is in
// testDb.ts, not in a repository.
describe("testDb", () => {
  it("builds a real sqlite db from the checked-in migrations and round-trips a json column", () => {
    const db = createTestDb();

    db.insert(diaryTable)
      .values({
        id: -1,
        data: { name: "Test Diary", nested: { count: 3 } },
        op: "create",
        status: "pending",
        updatedAt: Date.now(),
      })
      .run();

    const [row] = db
      .select()
      .from(diaryTable)
      .where(eq(diaryTable.id, -1))
      .all();

    expect(row?.data).toEqual({ name: "Test Diary", nested: { count: 3 } });
    expect(row?.op).toBe("create");
    expect(row?.status).toBe("pending");
  });
});
