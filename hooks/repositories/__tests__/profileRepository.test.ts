import { and, eq } from "drizzle-orm";
import { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { createTestDb, loadRepos } from "../testDb";
import { mutationQueueTable, profileTable } from "../../../services/db/schema";
import * as schema from "../../../services/db/schema";
import { Profile } from "../../../types";

type ProfileRepo = typeof import("../profileRepository");

const SERVER_PROFILE: Profile = {
  user: 42,
  user_data: {
    username: "jdoe",
    first_name: "Jane",
    last_name: "Doe",
    email: "jane@example.com",
    is_active: true,
  },
  avatar: "avatar.jpg",
  avatar_thumbnail: "thumb.jpg",
  private: false,
  private_diary: false,
  registration_ip: "",
  timezone: "Europe/Berlin",
  territory: 5,
};

let db: BetterSQLite3Database<typeof schema>;
let profileRepository: ProfileRepo;

beforeEach(() => {
  db = createTestDb();
  const repos = loadRepos(db, ["profileRepository"]);
  profileRepository = repos.profileRepository as ProfileRepo;
});

const rawRow = () => db.select().from(profileTable).all()[0];

const mutationsFor = (entity: "profile" | "avatar") =>
  db
    .select()
    .from(mutationQueueTable)
    .where(and(eq(mutationQueueTable.entity, entity)))
    .all();

describe("applyLocalPatch", () => {
  it("merges the patch over the existing row and enqueues a profile mutation", () => {
    profileRepository.upsertProfileFromServer(SERVER_PROFILE);

    profileRepository.applyLocalPatch({ first_name: "Janet" });

    const row = rawRow();
    expect(row?.status).toBe("pending");
    expect(row?.firstName).toBe("Janet");
    // Untouched fields survive the merge.
    expect(row?.lastName).toBe("Doe");

    const mutations = mutationsFor("profile");
    expect(mutations).toHaveLength(1);
    expect(mutations[0].payload).toEqual({ first_name: "Janet" });
  });

  // applyLocalPatch has no `.where()`/upsert fallback on the row UPDATE — a
  // call with no existing row updates zero rows and orphans the mutation it
  // still queues. Unlike alertSettingsRepository's equivalent (a fixed
  // ROW_ID=1 singleton with a schema-free JSON blob, safe to upsert),
  // profileTable's primary key is the real server user id — applyLocalPatch
  // never receives it, and every NOT NULL column (username/first_name/
  // last_name/email/is_active/private/private_diary) has no default, so an
  // upsert here would have to fabricate a row's worth of fake user data.
  // Not fixed, because it's provably unreachable through the app: the only
  // caller (updateProfile in store/profile-context.tsx, called from
  // screens/ProfileScreen.tsx's submit handler) is gated behind `profile`
  // already being loaded (ProfileScreen returns a loading/error overlay
  // instead of rendering the form otherwise), and the backend guarantees a
  // Profile row exists for every User from the moment of registration
  // (myapi/signals.py's post_save receiver) — so "edit before any profile
  // was ever fetched" isn't a real user-reachable state, just what this
  // function does in isolation if that invariant were ever violated.
  it("does not create the profile row if none exists yet (documented invariant, not reachable through the app UI)", () => {
    profileRepository.applyLocalPatch({ first_name: "Janet" });

    expect(rawRow()).toBeUndefined();
    expect(mutationsFor("profile")).toHaveLength(1);
  });

  it("enqueues a second, independent mutation on a second call while the first is still pending", () => {
    profileRepository.upsertProfileFromServer(SERVER_PROFILE);

    profileRepository.applyLocalPatch({ first_name: "Janet" });
    profileRepository.applyLocalPatch({ territory: 9 });

    expect(mutationsFor("profile")).toHaveLength(2);
    const row = rawRow();
    expect(row?.firstName).toBe("Janet");
    expect(row?.territory).toBe(9);
  });
});

describe("queuePendingAvatar", () => {
  it("stores the pending upload uri/op on the row and enqueues an avatar mutation", () => {
    profileRepository.upsertProfileFromServer(SERVER_PROFILE);

    profileRepository.queuePendingAvatar("upload", "file://new-avatar.jpg");

    const row = rawRow();
    expect(row?.status).toBe("pending");
    expect(row?.pendingAvatarUri).toBe("file://new-avatar.jpg");
    expect(row?.pendingAvatarOp).toBe("upload");

    const mutations = mutationsFor("avatar");
    expect(mutations).toHaveLength(1);
    expect(mutations[0].payload).toEqual({ op: "upload", uri: "file://new-avatar.jpg" });
  });

  it("queues a delete the same way, with a null uri", () => {
    profileRepository.upsertProfileFromServer(SERVER_PROFILE);

    profileRepository.queuePendingAvatar("delete", null);

    const row = rawRow();
    expect(row?.pendingAvatarOp).toBe("delete");
    expect(row?.pendingAvatarUri).toBeNull();
  });
});

describe("getPendingAvatarMutation", () => {
  it("returns null when there is no pending avatar mutation", () => {
    profileRepository.upsertProfileFromServer(SERVER_PROFILE);
    expect(profileRepository.getPendingAvatarMutation()).toBeNull();
  });

  it("returns the oldest pending avatar mutation", () => {
    profileRepository.upsertProfileFromServer(SERVER_PROFILE);
    profileRepository.queuePendingAvatar("upload", "file://a.jpg");

    const mutation = profileRepository.getPendingAvatarMutation();
    expect(mutation).not.toBeNull();
    expect(mutation!.payload).toEqual({ op: "upload", uri: "file://a.jpg" });
  });
});

describe("resolvePendingAvatar", () => {
  it("clears the pending fields and marks the row synced when nothing else is pending", () => {
    profileRepository.upsertProfileFromServer(SERVER_PROFILE);
    profileRepository.queuePendingAvatar("upload", "file://a.jpg");
    const mutation = profileRepository.getPendingAvatarMutation()!;

    profileRepository.resolvePendingAvatar(mutation.id, {
      avatar: "server-avatar.jpg",
      avatarThumbnail: "server-thumb.jpg",
    });

    const row = rawRow();
    expect(row?.avatar).toBe("server-avatar.jpg");
    expect(row?.avatarThumbnail).toBe("server-thumb.jpg");
    expect(row?.pendingAvatarUri).toBeNull();
    expect(row?.pendingAvatarOp).toBeNull();
    expect(row?.status).toBe("synced");
    expect(mutationsFor("avatar")).toHaveLength(0);
  });

  it("leaves the row pending if a profile-field mutation is still outstanding", () => {
    profileRepository.upsertProfileFromServer(SERVER_PROFILE);
    profileRepository.applyLocalPatch({ first_name: "Janet" });
    profileRepository.queuePendingAvatar("upload", "file://a.jpg");
    const mutation = profileRepository.getPendingAvatarMutation()!;

    profileRepository.resolvePendingAvatar(mutation.id, { avatar: "a", avatarThumbnail: "t" });

    expect(rawRow()?.status).toBe("pending");
  });
});

describe("getPendingMutations / getFailedMutations", () => {
  it("reads back profile-entity mutations filtered by status", () => {
    profileRepository.upsertProfileFromServer(SERVER_PROFILE);
    profileRepository.applyLocalPatch({ first_name: "Janet" });

    expect(profileRepository.getPendingMutations()).toHaveLength(1);
    expect(profileRepository.getFailedMutations()).toHaveLength(0);
  });

  it("does not mix in avatar-entity mutations", () => {
    profileRepository.upsertProfileFromServer(SERVER_PROFILE);
    profileRepository.queuePendingAvatar("upload", "file://a.jpg");

    expect(profileRepository.getPendingMutations()).toHaveLength(0);
  });
});

describe("failMutation", () => {
  it("bumps attempts and marks both rows as error", () => {
    profileRepository.upsertProfileFromServer(SERVER_PROFILE);
    profileRepository.applyLocalPatch({ first_name: "Janet" });
    const [pending] = profileRepository.getPendingMutations();

    profileRepository.failMutation(pending.id, "boom");
    profileRepository.failMutation(pending.id, "boom again");

    const failed = profileRepository.getFailedMutations();
    expect(failed).toHaveLength(1);
    expect(failed[0].attempts).toBe(2);
    expect(failed[0].lastError).toBe("boom again");
    expect(rawRow()?.status).toBe("error");
  });
});

describe("retryMutation", () => {
  it("flips both the queue row and the profile row back to pending", () => {
    profileRepository.upsertProfileFromServer(SERVER_PROFILE);
    profileRepository.applyLocalPatch({ first_name: "Janet" });
    const [pending] = profileRepository.getPendingMutations();
    profileRepository.failMutation(pending.id, "boom");
    const [failed] = profileRepository.getFailedMutations();

    profileRepository.retryMutation(failed.id);

    expect(rawRow()?.status).toBe("pending");
    expect(profileRepository.getPendingMutations()).toHaveLength(1);
  });
});

describe("discardMutation vs. resolveMutation", () => {
  it("discardMutation checks for other remaining pending mutations (across both profile and avatar entities) first", () => {
    profileRepository.upsertProfileFromServer(SERVER_PROFILE);
    profileRepository.applyLocalPatch({ first_name: "Janet" });
    profileRepository.queuePendingAvatar("upload", "file://a.jpg");
    const [profileMutation] = profileRepository.getPendingMutations();
    const avatarMutation = profileRepository.getPendingAvatarMutation()!;

    profileRepository.discardMutation(profileMutation.id);
    // The avatar mutation is still pending, so the row must stay pending too.
    expect(rawRow()?.status).toBe("pending");

    profileRepository.discardMutation(avatarMutation.id);
    // Nothing left pending now — the row goes back to synced, and the
    // discarded avatar mutation's pending fields are cleared.
    expect(rawRow()?.status).toBe("synced");
    expect(rawRow()?.pendingAvatarUri).toBeNull();
    expect(rawRow()?.pendingAvatarOp).toBeNull();
  });

  it("resolveMutation checks for other remaining pending mutations too, same as discardMutation", () => {
    profileRepository.upsertProfileFromServer(SERVER_PROFILE);
    profileRepository.applyLocalPatch({ first_name: "Janet" });
    profileRepository.queuePendingAvatar("upload", "file://a.jpg");
    const [profileMutation] = profileRepository.getPendingMutations();

    profileRepository.resolveMutation(profileMutation.id);

    // The avatar mutation is still pending, so the row must stay pending too.
    expect(profileRepository.getPendingAvatarMutation()).not.toBeNull();
    expect(rawRow()?.status).toBe("pending");

    const avatarMutation = profileRepository.getPendingAvatarMutation()!;
    profileRepository.resolveMutation(avatarMutation.id);

    expect(rawRow()?.status).toBe("synced");
  });
});

describe("clearProfile", () => {
  it("wipes the profile row and both its profile/avatar queue entries", () => {
    profileRepository.upsertProfileFromServer(SERVER_PROFILE);
    profileRepository.applyLocalPatch({ first_name: "Janet" });
    profileRepository.queuePendingAvatar("upload", "file://a.jpg");

    profileRepository.clearProfile();

    expect(rawRow()).toBeUndefined();
    expect(mutationsFor("profile")).toHaveLength(0);
    expect(mutationsFor("avatar")).toHaveLength(0);
  });
});

describe("rowToProfile", () => {
  it("maps a stored row back to the Profile shape, including pending avatar fields", () => {
    profileRepository.upsertProfileFromServer(SERVER_PROFILE);
    profileRepository.queuePendingAvatar("upload", "file://a.jpg");

    const profile = profileRepository.rowToProfile(rawRow()!);

    expect(profile.user).toBe(42);
    expect(profile.user_data.username).toBe("jdoe");
    expect(profile.pendingAvatarUri).toBe("file://a.jpg");
    expect(profile.pendingAvatarOp).toBe("upload");
  });
});
