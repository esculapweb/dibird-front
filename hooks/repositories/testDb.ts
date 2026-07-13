import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import * as schema from "../../services/db/schema";

// Same real schema.ts the app uses (driver-agnostic drizzle-orm/sqlite-core),
// applied via drizzle's own better-sqlite3 migrator against the checked-in
// drizzle/*.sql + drizzle/meta/_journal.json — not a hand-rolled SQL parser,
// so there's nothing here to keep in sync if drizzle-kit's migration format
// ever changes. better-sqlite3 is fully synchronous, matching the sync-call
// shape (`.all()`/`.run()`/`.transaction()`, no `await`) every repository
// already assumes from drizzle-orm/expo-sqlite in production.
export const createTestDb = (): BetterSQLite3Database<typeof schema> => {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(__dirname, "../../drizzle") });
  return db;
};

// Repository modules capture `db` via `import { db } from "../../services/db/client"`
// once, when first evaluated. jest.setup.js globally mocks that module to
// `{}` for every test, so any repository test needs a per-file override —
// but a *static* top-level `import` of the module under test (or a
// cross-repo sibling it calls, e.g. observationRepository from
// diaryRepository's applyOverlay) is hoisted and binds to whatever was
// mocked at file-load time, before any per-test db exists, and never
// updates across resetModules() calls in later tests (a stale db
// reference, not a crash). Routing every repository import through this
// helper — reset + mock + require, always in that order — is what makes
// each test's repository instance(s) actually bound to that test's own
// in-memory db instead of a leftover from a previous test.
export const loadRepos = (
  db: BetterSQLite3Database<typeof schema>,
  names: string[],
): Record<string, unknown> => {
  jest.resetModules();
  jest.doMock("../../services/db/client", () => ({
    db,
    sqliteDb: {},
    runMigrations: jest.fn(async () => {}),
  }));

  const repos: Record<string, unknown> = {};
  for (const name of names) {
    repos[name] = require(`./${name}`);
  }
  return repos;
};
