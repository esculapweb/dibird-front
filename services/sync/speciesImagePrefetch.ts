import { Image } from "expo-image";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { fetchSpecies } from "../../util/fetches";
import { Config } from "../../constants/config";
import { AppError } from "../../types";
import { logError } from "../errors";
import { isConnected } from "./networkStatus";

const MARKER_KEY = "species_images_prefetched";
const PREFETCH_CONCURRENCY = 6;

const RETRY_BASE_MS = 4000;
const RETRY_MAX_MS = 60000;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelayMs = RETRY_BASE_MS;

const clearScheduledRetry = () => {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
};

const scheduleRetry = (territory: number) => {
  clearScheduledRetry();
  retryTimer = setTimeout(() => {
    retryTimer = null;
    runSpeciesImagePrefetch(territory);
  }, retryDelayMs);
  retryDelayMs = Math.min(retryDelayMs * 2, RETRY_MAX_MS);
};

export const stopSpeciesImagePrefetchRetries = () => {
  clearScheduledRetry();
  retryDelayMs = RETRY_BASE_MS;
};

const readPrefetchedTerritories = async (): Promise<number[]> => {
  try {
    const raw = await AsyncStorage.getItem(MARKER_KEY);
    if (!raw) return [];
    const marker = JSON.parse(raw) as { territories?: number[]; territory?: number };
    // territory (singular) is the pre-multi-territory marker shape; keep reading
    // it so upgrades don't lose an already-warmed cache and force a re-prefetch.
    if (Array.isArray(marker.territories)) return marker.territories;
    if (typeof marker.territory === "number") return [marker.territory];
    return [];
  } catch {
    return [];
  }
};

const wasAlreadyPrefetched = async (territory: number): Promise<boolean> => {
  const territories = await readPrefetchedTerritories();
  return territories.includes(territory);
};

const markPrefetched = async (territory: number): Promise<void> => {
  try {
    const territories = await readPrefetchedTerritories();
    if (!territories.includes(territory)) territories.push(territory);
    await AsyncStorage.setItem(MARKER_KEY, JSON.stringify({ territories }));
  } catch {
    // best-effort — worst case we re-run the prefetch next trigger
  }
};

const prefetchWithConcurrency = async (urls: string[]): Promise<void> => {
  let index = 0;

  const worker = async () => {
    while (index < urls.length) {
      const url = urls[index++];
      try {
        await Image.prefetch(url, "disk");
      } catch {
        // a single missing/broken thumb shouldn't abort the whole batch
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(PREFETCH_CONCURRENCY, urls.length) }, worker),
  );
};

let inFlight: Promise<void> | null = null;

// Warms expo-image's disk cache with every species thumbnail for the user's
// current territory, so browsing species offline (dropdowns, checklists,
// stat cards) doesn't come up empty just because the user never happened to
// scroll past that species while online. Runs once per territory (see
// wasAlreadyPrefetched) — re-running on every login/reconnect would just
// re-check a few thousand already-cached files for no benefit.
export const runSpeciesImagePrefetch = (territory: number | null): Promise<void> => {
  if (territory == null) return Promise.resolve();
  if (inFlight) return inFlight;

  clearScheduledRetry();
  inFlight = runSpeciesImagePrefetchInternal(territory).finally(() => {
    inFlight = null;
  });
  return inFlight;
};

const runSpeciesImagePrefetchInternal = async (territory: number): Promise<void> => {
  if (!isConnected()) return;
  if (await wasAlreadyPrefetched(territory)) return;

  try {
    const species = await fetchSpecies(territory, "name");
    const urls = [...new Set(species.map((item) => item.thumb).filter((thumb): thumb is string => !!thumb))].map(
      (thumb) => `${Config.mediaUrl}/${thumb}`,
    );

    await prefetchWithConcurrency(urls);
    await markPrefetched(territory);
    retryDelayMs = RETRY_BASE_MS;
  } catch (e) {
    const error = e as AppError;
    if (error.isNetworkError || error.isTimeout) {
      scheduleRetry(territory);
      return;
    }
    retryDelayMs = RETRY_BASE_MS;
    logError(error, "speciesImagePrefetch");
  }
};
