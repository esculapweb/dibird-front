import * as FileSystem from "expo-file-system/legacy";

// Local files of observation photos that haven't been uploaded yet.
//
// The picker and ImageManipulator both write into the cache directory, which
// the OS may purge at any time — fine for an upload that happens immediately,
// fatal for one that has to wait for the network to come back. Copying into
// documentDirectory is what makes a photo picked offline survive an app
// restart. Same reasoning (and the same directory) as the pending avatar in
// components/Profile/Avatar.tsx.

let counter = 0;

export const persistPickedPhoto = async (uri: string): Promise<string> => {
  const target = `${FileSystem.documentDirectory}observation-photo-${Date.now()}-${counter++}.jpg`;
  await FileSystem.copyAsync({ from: uri, to: target });
  return target;
};

// Best-effort by design: the file may already be gone (purged cache, a
// previous partial cleanup), and failing to delete it must never turn into a
// user-visible error on an otherwise successful upload.
export const deleteLocalPhoto = async (uri: string | null | undefined) => {
  if (!uri) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // ignore
  }
};

export const deleteLocalPhotos = async (uris: (string | null | undefined)[]) => {
  await Promise.all(uris.map(deleteLocalPhoto));
};
