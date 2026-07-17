import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "../../services/db/client";
import { mutationQueueTable, profileTable } from "../../services/db/schema";
import { Profile, ProfileFormData } from "../../types";

type ProfileInsert = typeof profileTable.$inferInsert;
type ProfileRow = typeof profileTable.$inferSelect;
export type MutationRow = typeof mutationQueueTable.$inferSelect;

// Both the "profile" (field edits, see applyLocalPatch) and "avatar" (see
// queuePendingAvatar) mutation-queue entities act on the same singleton
// profileTable row, so any "any pending/failed mutation left?" check needs to
// consider both — see discardMutation/clearProfile below.
const AVATAR_ENTITY = "avatar" as const;
const PROFILE_ENTITIES = ["profile", AVATAR_ENTITY] as const;

export const rowToProfile = (row: ProfileRow): Profile => ({
  user: row.user,
  user_data: {
    username: row.username,
    first_name: row.firstName,
    last_name: row.lastName,
    email: row.email,
    is_active: row.isActive,
  },
  avatar: row.avatar ?? "",
  avatar_thumbnail: row.avatarThumbnail ?? "",
  private: row.private,
  private_diary: row.privateDiary,
  registration_ip: row.registrationIp ?? "",
  timezone: row.timezone ?? "",
  territory: row.territory ?? null,
  pendingAvatarUri: row.pendingAvatarUri ?? null,
  pendingAvatarOp: row.pendingAvatarOp ?? null,
});

const toRow = (data: Profile, status: ProfileInsert["status"]): ProfileInsert => ({
  user: data.user as number,
  username: data.user_data.username,
  firstName: data.user_data.first_name,
  lastName: data.user_data.last_name,
  email: data.user_data.email,
  isActive: data.user_data.is_active,
  avatar: data.avatar,
  avatarThumbnail: data.avatar_thumbnail,
  private: data.private,
  privateDiary: data.private_diary,
  registrationIp: data.registration_ip,
  timezone: data.timezone,
  territory: data.territory ?? null,
  status,
  updatedAt: Date.now(),
});

export const upsertProfileFromServer = (data: Profile) => {
  const row = toRow(data, "synced");
  db.insert(profileTable)
    .values(row)
    .onConflictDoUpdate({ target: profileTable.user, set: row })
    .run();
};

// Guards against a logout racing an in-flight edit: if clearProfile() (see
// below) wins that race and wipes the row first, there is nothing left to
// patch and no user id on hand to fabricate one — queuing a mutation anyway
// would orphan it (no FK ties mutationQueueTable to a user), and it would
// sit there until the *next* login's sync blindly pushes stale data from
// the logged-out session onto whichever profile is current by then.
const hasProfileRow = (tx: { select: typeof db.select }) =>
  tx.select().from(profileTable).limit(1).all().length > 0;

export const applyLocalPatch = (patch: Partial<ProfileFormData>) => {
  db.transaction((tx) => {
    if (!hasProfileRow(tx)) return;

    const fields: Partial<ProfileInsert> = {};
    if (patch.first_name !== undefined) fields.firstName = patch.first_name;
    if (patch.last_name !== undefined) fields.lastName = patch.last_name;
    if (patch.username !== undefined) fields.username = patch.username;
    if (patch.territory !== undefined) fields.territory = patch.territory ?? null;
    if (patch.timezone !== undefined) fields.timezone = patch.timezone;
    if (patch.private !== undefined) fields.private = patch.private;
    if (patch.private_diary !== undefined) fields.privateDiary = patch.private_diary;

    tx.update(profileTable)
      .set({ ...fields, status: "pending", updatedAt: Date.now() })
      .run();

    tx.insert(mutationQueueTable)
      .values({
        entity: "profile",
        payload: patch,
        createdAt: Date.now(),
      })
      .run();
  });
};

export const queuePendingAvatar = (
  op: "upload" | "delete",
  uri: string | null,
) => {
  db.transaction((tx) => {
    if (!hasProfileRow(tx)) return;

    tx.update(profileTable)
      .set({
        pendingAvatarUri: uri,
        pendingAvatarOp: op,
        status: "pending",
        updatedAt: Date.now(),
      })
      .run();

    tx.insert(mutationQueueTable)
      .values({
        entity: AVATAR_ENTITY,
        payload: { op, uri },
        createdAt: Date.now(),
      })
      .run();
  });
};

export const getPendingAvatarMutation = (): MutationRow | null => {
  const rows = db
    .select()
    .from(mutationQueueTable)
    .where(
      and(
        eq(mutationQueueTable.entity, AVATAR_ENTITY),
        eq(mutationQueueTable.status, "pending"),
      ),
    )
    .orderBy(asc(mutationQueueTable.createdAt))
    .limit(1)
    .all();
  return rows[0] ?? null;
};

export const resolvePendingAvatar = (
  id: number,
  data: { avatar: string; avatarThumbnail: string },
) => {
  db.transaction((tx) => {
    tx.delete(mutationQueueTable).where(eq(mutationQueueTable.id, id)).run();

    const remaining = tx
      .select()
      .from(mutationQueueTable)
      .where(inArray(mutationQueueTable.entity, [...PROFILE_ENTITIES]))
      .all();

    tx.update(profileTable)
      .set({
        avatar: data.avatar,
        avatarThumbnail: data.avatarThumbnail,
        pendingAvatarUri: null,
        pendingAvatarOp: null,
        status: remaining.length > 0 ? "pending" : "synced",
        updatedAt: Date.now(),
      })
      .run();
  });
};

export const getPendingMutations = (): MutationRow[] =>
  db
    .select()
    .from(mutationQueueTable)
    .where(
      and(
        eq(mutationQueueTable.entity, "profile"),
        eq(mutationQueueTable.status, "pending"),
      ),
    )
    .orderBy(asc(mutationQueueTable.createdAt))
    .all();

export const getFailedMutations = (): MutationRow[] =>
  db
    .select()
    .from(mutationQueueTable)
    .where(
      and(
        eq(mutationQueueTable.entity, "profile"),
        eq(mutationQueueTable.status, "error"),
      ),
    )
    .orderBy(asc(mutationQueueTable.createdAt))
    .all();

export const resolveMutation = (id: number) => {
  db.transaction((tx) => {
    tx.delete(mutationQueueTable).where(eq(mutationQueueTable.id, id)).run();

    const remaining = tx
      .select()
      .from(mutationQueueTable)
      .where(inArray(mutationQueueTable.entity, [...PROFILE_ENTITIES]))
      .all();

    tx.update(profileTable)
      .set({ status: remaining.length > 0 ? "pending" : "synced" })
      .run();
  });
};

export const failMutation = (id: number, message: string) => {
  db.transaction((tx) => {
    tx.update(mutationQueueTable)
      .set({
        status: "error",
        lastError: message,
        attempts: sql`${mutationQueueTable.attempts} + 1`,
      })
      .where(eq(mutationQueueTable.id, id))
      .run();

    tx.update(profileTable).set({ status: "error" }).run();
  });
};

export const retryMutation = (id: number) => {
  db.transaction((tx) => {
    tx.update(mutationQueueTable)
      .set({ status: "pending", lastError: null })
      .where(eq(mutationQueueTable.id, id))
      .run();

    tx.update(profileTable).set({ status: "pending" }).run();
  });
};

export const discardMutation = (id: number) => {
  db.transaction((tx) => {
    const [mutation] = tx
      .select()
      .from(mutationQueueTable)
      .where(eq(mutationQueueTable.id, id))
      .all();

    tx.delete(mutationQueueTable).where(eq(mutationQueueTable.id, id)).run();

    const remaining = tx
      .select()
      .from(mutationQueueTable)
      .where(inArray(mutationQueueTable.entity, [...PROFILE_ENTITIES]))
      .all();

    tx.update(profileTable)
      .set({
        status: remaining.length > 0 ? "pending" : "synced",
        ...(mutation?.entity === AVATAR_ENTITY
          ? { pendingAvatarUri: null, pendingAvatarOp: null }
          : {}),
      })
      .run();
  });
};

export const clearProfile = () => {
  db.transaction((tx) => {
    tx.delete(profileTable).run();
    tx.delete(mutationQueueTable)
      .where(inArray(mutationQueueTable.entity, [...PROFILE_ENTITIES]))
      .run();
  });
};
