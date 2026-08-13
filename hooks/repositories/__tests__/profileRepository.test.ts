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

  // profileTable's primary key is the real server user id, so applyLocalPatch
  // can't upsert a row into existence the way alertSettingsRepository does
  // for its fixed ROW_ID=1 singleton. Rather than attempt that, a missing
  // row is treated as "nothing to do here" — see the logout-race describe
  // block below for why this is reachable (a forced logout racing an
  // in-flight edit), not just a theoretical guard.
  it("is a no-op — no row created, no mutation queued — when no profile row exists yet", () => {
    profileRepository.applyLocalPatch({ first_name: "Janet" });

    expect(rawRow()).toBeUndefined();
    expect(mutationsFor("profile")).toHaveLength(0);
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

  it("is a no-op — no row created, no mutation queued — when no profile row exists yet", () => {
    profileRepository.queuePendingAvatar("upload", "file://new-avatar.jpg");

    expect(rawRow()).toBeUndefined();
    expect(mutationsFor("avatar")).toHaveLength(0);
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

describe("logout race: clearProfile() interleaved with an in-flight edit", () => {
  // Reproduces a real (if narrow) path to the "no row exists yet" state
  // that the comment on the test above calls unreachable: ProfileScreen
  // does gate the form behind a loaded profile, but nothing stops a
  // forced logout (api.ts's 401 interceptor -> auth-context -> this
  // module's clearProfile()) from firing between the user tapping Save
  // and applyLocalPatch's transaction actually running - both are async
  // and unsynchronized. When clearProfile() wins that race, applyLocalPatch
  // still unconditionally queues a mutation-queue row for an UPDATE that
  // touched nothing. That row has no user/session reference, and
  // getPendingMutations()/pushPending() (services/sync/profileSync.ts)
  // don't filter by user either - so it survives to the *next* login and
  // gets pushed against whichever profile is current then.
  const OTHER_PROFILE: Profile = {
    ...SERVER_PROFILE,
    user: 99,
    user_data: { ...SERVER_PROFILE.user_data, username: "other", first_name: "Other" },
  };

  it("orphans a mutation that outlives the session and would leak into the next login's sync", () => {
    profileRepository.upsertProfileFromServer(SERVER_PROFILE);

    // Forced logout wins the race and clears everything first...
    profileRepository.clearProfile();
    // ...but the in-flight Save handler was already past the point of no
    // return and still calls applyLocalPatch.
    profileRepository.applyLocalPatch({ first_name: "Janet" });

    // A different account (or the same one, re-logging in) now loads on
    // this device.
    profileRepository.upsertProfileFromServer(OTHER_PROFILE);

    // The stale mutation from the logged-out session should not still be
    // sitting in the queue for the new session's sync to pick up and push.
    expect(profileRepository.getPendingMutations()).toHaveLength(0);
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

describe("rowToProfile on a sparse row", () => {
  // The server sends null for fields it has nothing for, but the UI binds
  // these straight into text inputs — so the mapper normalises them to empty
  // strings rather than letting a null reach the form.
  it("normalises missing optional fields to empty strings and nulls", () => {
    profileRepository.upsertProfileFromServer({
      ...SERVER_PROFILE,
      avatar: null as unknown as string,
      avatar_thumbnail: null as unknown as string,
      registration_ip: null as unknown as string,
      timezone: null as unknown as string,
      territory: null,
    });

    const profile = profileRepository.rowToProfile(rawRow()!);

    expect(profile.avatar).toBe("");
    expect(profile.avatar_thumbnail).toBe("");
    expect(profile.registration_ip).toBe("");
    expect(profile.timezone).toBe("");
    expect(profile.territory).toBeNull();
    expect(profile.pendingAvatarUri).toBeNull();
    expect(profile.pendingAvatarOp).toBeNull();
  });
});

describe("applyLocalPatch field by field", () => {
  const patchAndRead = (patch: Parameters<typeof profileRepository.applyLocalPatch>[0]) => {
    profileRepository.upsertProfileFromServer(SERVER_PROFILE);
    profileRepository.applyLocalPatch(patch);
    return rawRow()!;
  };

  it("writes every editable field it is given", () => {
    const row = patchAndRead({
      first_name: "Janet",
      last_name: "Roe",
      username: "jroe",
      territory: 9,
      timezone: "UTC",
      private: true,
      private_diary: true,
    });

    expect(row.firstName).toBe("Janet");
    expect(row.lastName).toBe("Roe");
    expect(row.username).toBe("jroe");
    expect(row.territory).toBe(9);
    expect(row.timezone).toBe("UTC");
    expect(row.private).toBe(true);
    expect(row.privateDiary).toBe(true);
    expect(row.status).toBe("pending");
  });

  it("leaves fields the patch does not mention untouched", () => {
    const row = patchAndRead({ first_name: "Janet" });

    expect(row.firstName).toBe("Janet");
    expect(row.lastName).toBe("Doe");
    expect(row.username).toBe("jdoe");
    expect(row.territory).toBe(5);
  });

  // "No home country" is a real choice in the profile form, so clearing the
  // territory has to survive the patch instead of being read as "unchanged".
  it("clears the territory when the patch explicitly nulls it", () => {
    const row = patchAndRead({ territory: null });

    expect(row.territory).toBeNull();
  });
});
