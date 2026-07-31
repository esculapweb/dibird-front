import AsyncStorage from "@react-native-async-storage/async-storage";
import { DateFilter } from "../types";

const SORT_KEY = "sorting";
const GLOBAL_KEY = "global";
// Deliberately NOT included in Logout()'s AsyncStorage.multiRemove (util/auth.ts)
// — it needs to survive logout so the next login can compare against it and
// tell "same user re-authenticating" from "different account on this device"
// (see store/profile-context.tsx).
const LAST_USER_KEY = "last_logged_in_user";

const saveItem = async (key: string, screen: string, value: unknown): Promise<void> => {
  try {
    const json = await AsyncStorage.getItem(key);
    const allData: Record<string, unknown> = json ? JSON.parse(json) : {};
    allData[screen] = value;
    await AsyncStorage.setItem(key, JSON.stringify(allData));
  } catch (e) {
    if (__DEV__) console.warn(`Failed to save ${key}`, e);
  }
};

const loadItem = async (key: string, screen: string): Promise<unknown> => {
  try {
    const json = await AsyncStorage.getItem(key);
    const allData: Record<string, unknown> = json ? JSON.parse(json) : {};

    return allData[screen] ?? null;
  } catch (e) {
    if (__DEV__) console.warn(`Failed to load ${key}`, e);
    return null;
  }
};

const clearItem = async (key: string, screen: string): Promise<void> => {
  try {
    const json = await AsyncStorage.getItem(key);
    const allData: Record<string, unknown> = json ? JSON.parse(json) : {};
    delete allData[screen];
    await AsyncStorage.setItem(key, JSON.stringify(allData));
  } catch (e) {
    if (__DEV__) console.warn(`Failed to clear ${key}`, e);
  }
};

export const saveSort = (screen: string, value: string | null): Promise<void> => saveItem(SORT_KEY, screen, value);
export const loadSort = (screen: string): Promise<unknown> => loadItem(SORT_KEY, screen);
export const clearSort = (screen: string): Promise<void> => clearItem(SORT_KEY, screen);

export const saveGlobalTerritory = (value: number | null): Promise<void> => saveItem(GLOBAL_KEY, "territory", value);
export const loadGlobalTerritory = (): Promise<unknown> => loadItem(GLOBAL_KEY, "territory");

export const saveGlobalDateFilter = (value: DateFilter | null): Promise<void> => saveItem(GLOBAL_KEY, "dateFilter", value);
export const loadGlobalDateFilter = (): Promise<unknown> => loadItem(GLOBAL_KEY, "dateFilter");


export const saveGlobalPlace = (value: number | null): Promise<void> => saveItem(GLOBAL_KEY, "placeFilter", value);
export const loadGlobalPlace = (): Promise<unknown> => loadItem(GLOBAL_KEY, "placeFilter");

export const saveGlobalSpecies = (value: number | null): Promise<void> => saveItem(GLOBAL_KEY, "species", value);
export const loadGlobalSpecies = (): Promise<unknown> => loadItem(GLOBAL_KEY, "species");


export const clearAllGlobalFilters = async (): Promise<void> => {
  await AsyncStorage.multiRemove([GLOBAL_KEY, "filters_inited"]);
};

export const getLastLoggedInUserId = async (): Promise<number | null> => {
  try {
    const raw = await AsyncStorage.getItem(LAST_USER_KEY);
    return raw ? Number(raw) : null;
  } catch (e) {
    if (__DEV__) console.warn(`Failed to load ${LAST_USER_KEY}`, e);
    return null;
  }
};

export const setLastLoggedInUserId = async (userId: number): Promise<void> => {
  try {
    await AsyncStorage.setItem(LAST_USER_KEY, String(userId));
  } catch (e) {
    if (__DEV__) console.warn(`Failed to save ${LAST_USER_KEY}`, e);
  }
};

// Activation: the first observation created. The event must go out exactly once,
// otherwise "the share of people who reached their first observation" turns into
// "how many observations were created in total". Like LAST_USER_KEY, the flag
// survives a logout — otherwise the same person signing in again would look like a
// new activation.
const FIRST_OBSERVATION_KEY = "first_observation_tracked";

export const markFirstObservationTracked = async (): Promise<boolean> => {
  try {
    if (await AsyncStorage.getItem(FIRST_OBSERVATION_KEY)) return false;
    await AsyncStorage.setItem(FIRST_OBSERVATION_KEY, "true");
    return true;
  } catch (e) {
    if (__DEV__) console.warn(`Failed to save ${FIRST_OBSERVATION_KEY}`, e);
    return false;
  }
};

/**
 * The "a signup has just happened" flag, set at the three `sign_up` points
 * (util/auth.ts). The gate is deliberately built on it rather than on "the
 * onboarding has already been seen": by the absence of the latter a veteran who
 * reinstalled the app and signed into an old account is indistinguishable from a
 * newcomer — they would get "pick a country → record your first species" as the
 * root of the stack. Here the absence of the key means "do not show", and all
 * existing installations are immune by construction, without a backfill.
 *
 * Like the two keys above, the flag is not in the allowlist of
 * `AsyncStorage.multiRemove` in `Logout()`: an email signup leads out of the app
 * for confirmation and comes back through the `Login` screen, and the flag has to
 * survive that path.
 */
const ONBOARDING_KEY = "onboarding_pending";

export const isOnboardingPending = async (): Promise<boolean> => {
  try {
    return !!(await AsyncStorage.getItem(ONBOARDING_KEY));
  } catch (e) {
    if (__DEV__) console.warn(`Failed to load ${ONBOARDING_KEY}`, e);
    // The disk cannot be read — better not to show the onboarding than to show it
    // to someone it is not meant for: a repeated flow annoys more than a missed one.
    return false;
  }
};

export const markOnboardingPending = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
  } catch (e) {
    if (__DEV__) console.warn(`Failed to save ${ONBOARDING_KEY}`, e);
  }
};

export const clearOnboardingPending = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(ONBOARDING_KEY);
  } catch (e) {
    if (__DEV__) console.warn(`Failed to clear ${ONBOARDING_KEY}`, e);
  }
};

export const initGlobalFilters = async (profileTerritory: number | null): Promise<void> => {
  const alreadyInited = await AsyncStorage.getItem("filters_inited");
  if (alreadyInited) return;

  const savedTerritory = await loadGlobalTerritory();
  const savedDate = await loadGlobalDateFilter();

  if (!savedTerritory && profileTerritory)
    await saveGlobalTerritory(profileTerritory);

  if (!savedDate)
    await saveGlobalDateFilter({
      type: "this_year",
    });

  await AsyncStorage.setItem("filters_inited", "true");
};
