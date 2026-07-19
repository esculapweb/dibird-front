import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

// Every repository test (see hooks/repositories/testDb.ts) applies the full
// migration chain to a brand-new, empty in-memory db — a real device
// upgrading the app instead applies only the *new* migrations on top of a
// db that already has rows in it. Nothing exercised that path before this:
// an ALTER TABLE that isn't purely additive (e.g. a NOT NULL column with no
// default) would pass every existing test yet corrupt/reject on a real
// user's populated db. See RELEASE_CHECKLIST.md's targeted-risk list.
//
// This runs the raw .sql files directly with better-sqlite3, deliberately
// bypassing drizzle's own migrator/bookkeeping table (drizzle-orm/
// better-sqlite3/migrator always applies every migration in the folder to
// whatever db it's given — there's no supported way to ask it to stop
// partway through), since only the DDL's effect on pre-existing rows is
// under test here, not drizzle's own migration-tracking.
//
// "--> statement-breakpoint" is drizzle-kit's own marker between
// statements in one file — it's still a valid SQL line comment (starts
// with "--"), so better-sqlite3's exec() can run a whole file's raw text
// as one multi-statement script without needing to split on it.
const MIGRATIONS_DIR = path.join(__dirname, "../../../drizzle");

const migrationFiles = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const readMigration = (file: string) =>
  fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");

it("has migration files to test against (guards against a path typo silently no-op'ing this suite)", () => {
  expect(migrationFiles.length).toBeGreaterThan(0);
});

describe("0012 (adds profile.pending_avatar_uri/pending_avatar_op)", () => {
  it("preserves an existing profile row's data across the upgrade", () => {
    const sqlite = new Database(":memory:");
    try {
      const upToPrevious = migrationFiles.filter((f) => f < "0012");
      upToPrevious.forEach((f) => sqlite.exec(readMigration(f)));

      sqlite
        .prepare(
          `INSERT INTO profile
            (user, username, first_name, last_name, email, is_active,
             avatar, avatar_thumbnail, private, private_diary,
             registration_ip, timezone, territory, status, updated_at)
           VALUES
            (1, 'birder', 'Ada', 'Lovelace', 'ada@example.com', 1,
             NULL, NULL, 0, 0,
             '1.2.3.4', 'Europe/Minsk', 5, 'synced', 1700000000000)`,
        )
        .run();

      const migration0012 = migrationFiles.find((f) => f.startsWith("0012"));
      sqlite.exec(readMigration(migration0012!));

      const row = sqlite
        .prepare("SELECT * FROM profile WHERE user = 1")
        .get() as Record<string, unknown>;

      // Every pre-existing column survives the upgrade unchanged.
      expect(row).toMatchObject({
        user: 1,
        username: "birder",
        first_name: "Ada",
        last_name: "Lovelace",
        email: "ada@example.com",
        registration_ip: "1.2.3.4",
        timezone: "Europe/Minsk",
        territory: 5,
        status: "synced",
      });
      // The two new columns exist and default to NULL for a pre-existing
      // row, rather than the ALTER TABLE failing or dropping the row.
      expect(row.pending_avatar_uri).toBeNull();
      expect(row.pending_avatar_op).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it("also creates the new cache tables from the same migration, queryable and empty", () => {
    const sqlite = new Database(":memory:");
    try {
      migrationFiles.forEach((f) => sqlite.exec(readMigration(f)));

      for (const table of [
        "diary_species_ids_cache",
        "map_preview_cache",
        "user_profile_cache",
      ]) {
        expect(
          sqlite.prepare(`SELECT COUNT(*) as n FROM ${table}`).get(),
        ).toEqual({ n: 0 });
      }
    } finally {
      sqlite.close();
    }
  });
});

it("applies every migration in order against an already-populated db without error", () => {
  // Broader regression guard, not specific to one migration: seeds one row
  // per entity table right after that table is created, then keeps
  // applying every later migration on top — the general shape of a real
  // device that's been through several app updates already, each adding
  // more tables/columns around existing data. Fails loudly (an exec()
  // throw) the moment any future migration stops being purely additive
  // against a populated table.
  const sqlite = new Database(":memory:");
  try {
    const seedAfter: Record<string, () => void> = {
      "0000": () =>
        sqlite
          .prepare(
            `INSERT INTO profile
              (user, username, first_name, last_name, email, is_active, private, private_diary, status, updated_at)
             VALUES (1, 'birder', 'Ada', 'Lovelace', 'ada@example.com', 1, 0, 0, 'synced', 1700000000000)`,
          )
          .run(),
      "0003": () =>
        sqlite
          .prepare(
            `INSERT INTO observation (id, data, status, updated_at) VALUES (100, '{}', 'synced', 1700000000000)`,
          )
          .run(),
      "0004": () =>
        sqlite
          .prepare(
            `INSERT INTO diary (id, data, status, updated_at) VALUES (200, '{}', 'synced', 1700000000000)`,
          )
          .run(),
      "0005": () =>
        sqlite
          .prepare(
            `INSERT INTO place (id, data, status, updated_at) VALUES (300, '{}', 'synced', 1700000000000)`,
          )
          .run(),
    };

    for (const file of migrationFiles) {
      expect(() => sqlite.exec(readMigration(file))).not.toThrow();
      const prefix = file.slice(0, 4);
      seedAfter[prefix]?.();
    }

    expect(
      sqlite.prepare("SELECT username FROM profile WHERE user = 1").get(),
    ).toEqual({ username: "birder" });
    expect(
      sqlite.prepare("SELECT id FROM observation WHERE id = 100").get(),
    ).toEqual({ id: 100 });
    expect(
      sqlite.prepare("SELECT id FROM diary WHERE id = 200").get(),
    ).toEqual({ id: 200 });
    expect(
      sqlite.prepare("SELECT id FROM place WHERE id = 300").get(),
    ).toEqual({ id: 300 });
  } finally {
    sqlite.close();
  }
});
