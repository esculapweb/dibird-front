// The queue behind observation photos, which is deliberately separate from the
// observation's own (see services/db/schema.ts): the display copy of a photo
// lives inside observationTable.data.photos so every existing read path keeps
// working, while the file to upload, the retry state and the server id live in
// observation_photo. Every test here is about those two staying in step.
jest.mock("../referenceRepository", () => ({
  getCachedCountries: jest.fn(() => []),
}));

import { eq } from "drizzle-orm";
import { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { createTestDb, loadRepos } from "../testDb";
import {
  mutationQueueTable,
  observationPhotoTable,
  observationTable,
} from "../../../services/db/schema";
import * as schema from "../../../services/db/schema";
import { ObservationItem, ObservationPhoto } from "../../../types";

type PhotoRepo = typeof import("../observationPhotoRepository");

let db: BetterSQLite3Database<typeof schema>;
let repo: PhotoRepo;

const OBSERVATION_ID = -101;

const seedObservation = (id: number, photos: ObservationPhoto[] = []) => {
  const row = {
    id,
    data: { id, photos } as unknown as ObservationItem,
    op: "create" as const,
    status: "pending" as const,
    updatedAt: Date.now(),
  };
  db.insert(observationTable)
    .values(row)
    .onConflictDoUpdate({ target: observationTable.id, set: row })
    .run();
};

const photosOf = (id: number) =>
  ((db.select().from(observationTable).where(eq(observationTable.id, id)).all()[0]
    ?.data as ObservationItem | undefined)?.photos ?? []) as ObservationPhoto[];

const photoRows = () => db.select().from(observationPhotoTable).all();

const queued = () =>
  db
    .select()
    .from(mutationQueueTable)
    .where(eq(mutationQueueTable.entity, "observationPhoto"))
    .all();

const serverPhoto = (overrides: Partial<ObservationPhoto> = {}): ObservationPhoto => ({
  id: 900,
  image: "observation/ab/cd/900.jpg",
  thumbnail: "observation/ab/cd/900.jpg.400x400.jpg",
  sort_order: 0,
  created_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

beforeEach(() => {
  db = createTestDb();
  const repos = loadRepos(db, ["observationPhotoRepository"]);
  repo = repos.observationPhotoRepository as PhotoRepo;
  seedObservation(OBSERVATION_ID);
});

describe("queueUploads", () => {
  it("writes the queue row, the mutation and the optimistic entry at once", () => {
    repo.queueUploads(OBSERVATION_ID, [{ uri: "file:///a.jpg" }]);

    const [row] = photoRows();
    expect(row.op).toBe("upload");
    expect(row.status).toBe("pending");
    expect(row.localUri).toBe("file:///a.jpg");
    expect(row.clientRequestId).toBeTruthy();

    expect(queued()).toHaveLength(1);

    const [photo] = photosOf(OBSERVATION_ID);
    expect(photo.id).toBe(row.id);
    expect(photo.local_uri).toBe("file:///a.jpg");
    expect(photo._pendingSync).toBe("pending");
  });

  it("continues sort_order instead of restarting it", () => {
    repo.queueUploads(OBSERVATION_ID, [{ uri: "file:///a.jpg" }]);
    repo.queueUploads(OBSERVATION_ID, [
      { uri: "file:///b.jpg" },
      { uri: "file:///c.jpg" },
    ]);

    expect(photosOf(OBSERVATION_ID).map((p) => p.sort_order)).toEqual([0, 1, 2]);
  });

  it("patches both rows of an observation that already synced", () => {
    // After replaceLocalWithServer the same observation lives under its temp id
    // (as an alias) and under the real one — patching only one leaves the other
    // showing a stale strip.
    seedObservation(555);
    db.update(observationTable)
      .set({ data: { id: 555, photos: [] } as unknown as ObservationItem })
      .where(eq(observationTable.id, OBSERVATION_ID))
      .run();

    repo.queueUploads(OBSERVATION_ID, [{ uri: "file:///a.jpg" }]);

    expect(photosOf(OBSERVATION_ID)).toHaveLength(1);
    expect(photosOf(555)).toHaveLength(1);
  });
});

describe("queueDelete", () => {
  it("just drops a photo that never left the device, without queueing anything", () => {
    repo.queueUploads(OBSERVATION_ID, [{ uri: "file:///a.jpg" }]);
    const [pending] = photosOf(OBSERVATION_ID);

    const file = repo.queueDelete(OBSERVATION_ID, pending);

    expect(file).toBe("file:///a.jpg");
    expect(photoRows()).toHaveLength(0);
    expect(queued()).toHaveLength(0);
    expect(photosOf(OBSERVATION_ID)).toHaveLength(0);
  });

  it("queues a server-side delete for a photo that already exists remotely", () => {
    seedObservation(OBSERVATION_ID, [serverPhoto()]);

    const file = repo.queueDelete(OBSERVATION_ID, serverPhoto());

    expect(file).toBeNull();
    const [row] = photoRows();
    expect(row.op).toBe("delete");
    expect(row.serverId).toBe(900);
    expect(queued()).toHaveLength(1);
    expect(photosOf(OBSERVATION_ID)).toHaveLength(0);
  });
});

describe("claimNextMutation", () => {
  it("hands out each mutation exactly once", () => {
    repo.queueUploads(OBSERVATION_ID, [
      { uri: "file:///a.jpg" },
      { uri: "file:///b.jpg" },
    ]);

    const first = repo.claimNextMutation();
    const second = repo.claimNextMutation();

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(repo.claimNextMutation()).toBeNull();
    expect(queued()).toHaveLength(0);
  });
});

describe("resolveUpload", () => {
  it("replaces the optimistic entry with the server's own and returns the local file", () => {
    repo.queueUploads(OBSERVATION_ID, [{ uri: "file:///a.jpg" }]);
    const [pending] = photosOf(OBSERVATION_ID);

    const file = repo.resolveUpload(pending.id, [OBSERVATION_ID, 555], serverPhoto());

    expect(file).toBe("file:///a.jpg");
    expect(photoRows()).toHaveLength(0);
    const [photo] = photosOf(OBSERVATION_ID);
    expect(photo.id).toBe(900);
    expect(photo.local_uri).toBeUndefined();
    expect(photo.thumbnail).toBe("observation/ab/cd/900.jpg.400x400.jpg");
  });
});

describe("requeueFailedMutation", () => {
  it("marks the photo itself, not the observation", () => {
    repo.queueUploads(OBSERVATION_ID, [{ uri: "file:///a.jpg" }]);
    const [pending] = photosOf(OBSERVATION_ID);
    const mutation = repo.claimNextMutation()!;

    repo.requeueFailedMutation(
      mutation.payload as never,
      mutation.createdAt,
      mutation.attempts,
      "Photo limit reached",
    );

    expect(photoRows()[0].status).toBe("error");
    expect(queued()[0].status).toBe("error");
    const [photo] = photosOf(OBSERVATION_ID);
    expect(photo.id).toBe(pending.id);
    expect(photo._pendingSync).toBe("error");
    expect(photo._syncError).toBe("Photo limit reached");
    // The observation's own row is untouched — a failed photo must not raise
    // the failed-edit banner for the whole observation.
    expect(
      db.select().from(observationTable).where(eq(observationTable.id, OBSERVATION_ID)).all()[0]
        ?.status,
    ).toBe("pending");
  });
});

describe("restorePhoto", () => {
  it("puts a photo back when its deletion failed", () => {
    seedObservation(OBSERVATION_ID, []);

    repo.restorePhoto(OBSERVATION_ID, serverPhoto());
    repo.restorePhoto(OBSERVATION_ID, serverPhoto());

    expect(photosOf(OBSERVATION_ID)).toHaveLength(1);
  });
});

describe("discardPhoto", () => {
  it("drops the row, its mutation and hands back the file", () => {
    repo.queueUploads(OBSERVATION_ID, [{ uri: "file:///a.jpg" }]);
    const [pending] = photosOf(OBSERVATION_ID);

    expect(repo.discardPhoto(pending.id)).toBe("file:///a.jpg");
    expect(photoRows()).toHaveLength(0);
    expect(queued()).toHaveLength(0);
  });
});

describe("clearForObservation / clearAllLocal", () => {
  it("returns every queued local file and empties the queue", () => {
    repo.queueUploads(OBSERVATION_ID, [
      { uri: "file:///a.jpg" },
      { uri: "file:///b.jpg" },
    ]);

    expect(repo.clearForObservation(OBSERVATION_ID).sort()).toEqual([
      "file:///a.jpg",
      "file:///b.jpg",
    ]);
    expect(photoRows()).toHaveLength(0);
    expect(queued()).toHaveLength(0);
  });

  it("clearAllLocal wipes photos of every observation", () => {
    seedObservation(-202);
    repo.queueUploads(OBSERVATION_ID, [{ uri: "file:///a.jpg" }]);
    repo.queueUploads(-202, [{ uri: "file:///b.jpg" }]);

    expect(repo.clearAllLocal()).toHaveLength(2);
    expect(photoRows()).toHaveLength(0);
    expect(queued()).toHaveLength(0);
  });
});
