import AsyncStorage from "@react-native-async-storage/async-storage";

import { CATALOG_SCREEN_NAMES } from "../constants/catalogScreens";
import type { MinimalRoute } from "../types";

/**
 * Where to return the guest after they created an account straight from a
 * reference page (the `useRequireAuth` sheet).
 *
 * The login switches `Navigation` from `AuthStack` to `AppStack` — the navigator
 * is recreated from scratch, and without this the user ended up on MainScreen
 * rather than on the bird they signed up for. Not a navigation parameter: the
 * path may go through the Login screen (signing in by email), and an intermediate
 * screen must know nothing about this.
 *
 * Only the screen name and its parameters are stored — the state at the moment the
 * guest hit the wall.
 *
 * **Why this is also in AsyncStorage.** Email signup leads out of the app:
 * `CheckEmail` → mail client → the link from the letter → the deep link
 * `accounts/confirm-email/:key` → `ConfirmEmail` → `Login`. By the time of the
 * return the process has most likely been killed, and the module variable along
 * with it — that is, the return did not work on exactly the longest path. An
 * Apple/Google sign-in never leaves the app, the variable is enough there, so it
 * stays a synchronous cache: the hot path does not wait for the disk.
 */
let pendingReturn: MinimalRoute | null = null;

const CARRY_OVER = new Set<string>(CATALOG_SCREEN_NAMES);

const STORAGE_KEY = "auth_return";

/**
 * A day. Enough for the slowest path (the letter may be opened in the evening),
 * but not so much as to throw a person a week later onto a bird they have already
 * forgotten about: an unexpected jump is worse than a missing one.
 */
const TTL_MS = 24 * 60 * 60 * 1000;

type StoredReturn = MinimalRoute & { savedAt: number };

const isStoredReturn = (raw: unknown): raw is StoredReturn =>
  !!raw &&
  typeof raw === "object" &&
  typeof (raw as StoredReturn).name === "string" &&
  typeof (raw as StoredReturn).savedAt === "number";

/**
 * Remember the screen. Screens outside the reference are ignored: `AppStack` does
 * not have them, there is nothing to restore.
 */
export const setAuthReturn = async (route: MinimalRoute | null): Promise<void> => {
  const next = route && CARRY_OVER.has(route.name) ? route : null;
  pendingReturn = next;

  try {
    if (!next) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return;
    }
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...next, savedAt: Date.now() } satisfies StoredReturn),
    );
  } catch (e) {
    // Not critical: the warm path (Apple/Google in the sheet) is served by the
    // variable above, without the disk.
    if (__DEV__) console.warn(`Failed to save ${STORAGE_KEY}`, e);
  }
};

/**
 * Take it and forget it. Called on any change of authentication, including a
 * logout — so that the intent does not outlive the situation it was set for.
 */
export const takeAuthReturn = async (): Promise<MinimalRoute | null> => {
  const inMemory = pendingReturn;
  pendingReturn = null;

  let stored: MinimalRoute | null = null;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    await AsyncStorage.removeItem(STORAGE_KEY);

    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (
      isStoredReturn(parsed) &&
      CARRY_OVER.has(parsed.name) &&
      Date.now() - parsed.savedAt < TTL_MS
    ) {
      stored = { name: parsed.name, params: parsed.params };
    }
  } catch (e) {
    if (__DEV__) console.warn(`Failed to load ${STORAGE_KEY}`, e);
  }

  return inMemory ?? stored;
};
