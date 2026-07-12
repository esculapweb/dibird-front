import { patchAvatar, deleteMyAvatar } from "../../util/fetches";
import { AppError } from "../../types";
import {
  failMutation,
  getPendingAvatarMutation,
  resolvePendingAvatar,
} from "../../hooks/repositories/profileRepository";
import { isConnected } from "./networkStatus";
import { pullProfile } from "./profileSync";

interface AvatarMutationPayload {
  op: "upload" | "delete";
  uri: string | null;
}

export const runAvatarSync = async () => {
  if (!isConnected()) return;

  const mutation = getPendingAvatarMutation();
  if (!mutation) return;

  const { op, uri } = mutation.payload as AvatarMutationPayload;

  try {
    if (op === "upload" && uri) {
      const { avatar_thumbnail } = await patchAvatar({ uri });
      resolvePendingAvatar(mutation.id, {
        avatar: avatar_thumbnail,
        avatarThumbnail: avatar_thumbnail,
      });
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
