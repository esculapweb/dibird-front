import * as FileSystem from "expo-file-system/legacy";
import { patchAvatar, deleteMyAvatar } from "../../util/fetches";
import { AppError } from "../../types";
import {
  failMutation,
  getPendingAvatarMutation,
  getQueuedAvatarUris,
  resolvePendingAvatar,
} from "../../hooks/repositories/profileRepository";
import { isConnected } from "./networkStatus";
import { pullProfile } from "./profileSync";

interface AvatarMutationPayload {
  op: "upload" | "delete";
  uri: string | null;
}

// Avatar.tsx copies the picked photo here so a pending upload survives an app
// restart offline. Nothing used to delete these copies (#471).
export const PENDING_AVATAR_PREFIX = "pending-avatar-";

const isPendingAvatarFile = (uri: string) =>
  !!FileSystem.documentDirectory &&
  uri.startsWith(`${FileSystem.documentDirectory}${PENDING_AVATAR_PREFIX}`);

// Best-effort: a file that cannot be removed is a few hundred KB left behind,
// not a reason to fail a sync that has already succeeded on the server.
const removeLocalFile = (uri: string) =>
  FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});

// Avatar.tsx copies the file first and queues it a moment later; a sync
// triggered elsewhere in between would see a file no row points at yet. The
// name carries Date.now() of the copy, so leave anything younger alone.
export const ORPHAN_MIN_AGE_MS = 60 * 60_000;

const createdAt = (name: string) =>
  Number(name.slice(PENDING_AVATAR_PREFIX.length).split(".")[0]);

// Copies left behind by earlier app versions, and by uploads that resolved
// before this cleanup existed. Only files no queue row points at any more.
export const sweepOrphanAvatarFiles = async (now = Date.now()) => {
  const dir = FileSystem.documentDirectory;
  if (!dir) return;
  try {
    const names = await FileSystem.readDirectoryAsync(dir);
    const owned = new Set(getQueuedAvatarUris());
    await Promise.all(
      names
        .filter((name) => name.startsWith(PENDING_AVATAR_PREFIX))
        .filter((name) => {
          const ts = createdAt(name);
          // An unparsable name is not ours to judge by age; skip it.
          return Number.isFinite(ts) && now - ts > ORPHAN_MIN_AGE_MS;
        })
        .map((name) => `${dir}${name}`)
        .filter((uri) => !owned.has(uri))
        .map(removeLocalFile),
    );
  } catch {
    // Housekeeping only; the next trigger tries again.
  }
};

export const runAvatarSync = async () => {
  if (!isConnected()) return;

  const mutation = getPendingAvatarMutation();
  if (!mutation) {
    await sweepOrphanAvatarFiles();
    return;
  }

  const { op, uri } = mutation.payload as AvatarMutationPayload;

  try {
    if (op === "upload" && uri) {
      const { avatar_thumbnail } = await patchAvatar({ uri });
      resolvePendingAvatar(mutation.id, {
        avatar: avatar_thumbnail,
        avatarThumbnail: avatar_thumbnail,
      });
      // Only after resolve: until then the queue row still points at the
      // file, and a failed upload must keep it for the retry.
      if (isPendingAvatarFile(uri)) await removeLocalFile(uri);
    } else {
      await deleteMyAvatar();
      resolvePendingAvatar(mutation.id, { avatar: "", avatarThumbnail: "" });
    }
    // Best-effort: pick up the full-size `avatar` URL too (patchAvatar only
    // returns the thumbnail). A later trigger retries if this pull fails.
    await pullProfile().catch(() => {});
  } catch (e) {
    const error = e as AppError;
    if (error.isNetworkError || error.isTimeout) return;
    failMutation(mutation.id, error.message);
  }
};
