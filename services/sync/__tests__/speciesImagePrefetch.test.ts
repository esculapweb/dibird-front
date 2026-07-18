// jest.config.js's setupFiles path only evaluates the async-storage mock
// module without wiring it up as a replacement — see
// util/__tests__/storageHelper.test.ts's identical comment.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("expo-image", () => ({
  Image: { prefetch: jest.fn(async () => true) },
}));
jest.mock("../../../util/fetches", () => ({
  fetchSpecies: jest.fn(),
}));
jest.mock("../networkStatus", () => ({
  isConnected: jest.fn(() => true),
}));
jest.mock("../../errors", () => ({
  logError: jest.fn(),
}));
jest.mock("../../../constants/config", () => ({
  Config: { mediaUrl: "https://media.example.com/media" },
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";

import { fetchSpecies } from "../../../util/fetches";
import { isConnected } from "../networkStatus";
import {
  runSpeciesImagePrefetch,
  stopSpeciesImagePrefetchRetries,
} from "../speciesImagePrefetch";

const fetchSpeciesMock = fetchSpecies as jest.Mock;
const prefetchMock = Image.prefetch as jest.Mock;

const species = (thumb: string | null) => ({ value: 1, label: "a", thumb: thumb ?? undefined });

beforeEach(async () => {
  jest.clearAllMocks();
  (isConnected as jest.Mock).mockReturnValue(true);
  await AsyncStorage.clear();
  stopSpeciesImagePrefetchRetries();
});

afterEach(() => {
  jest.useRealTimers();
});

it("does nothing when territory is null", async () => {
  await runSpeciesImagePrefetch(null);
  expect(fetchSpeciesMock).not.toHaveBeenCalled();
});

it("does nothing while offline", async () => {
  (isConnected as jest.Mock).mockReturnValue(false);

  await runSpeciesImagePrefetch(5);

  expect(fetchSpeciesMock).not.toHaveBeenCalled();
});

it("prefetches every distinct thumbnail for the territory's species list", async () => {
  fetchSpeciesMock.mockResolvedValueOnce([
    species("a.jpg"),
    species("b.jpg"),
    species("a.jpg"),
    species(null),
  ]);

  await runSpeciesImagePrefetch(5);

  expect(fetchSpeciesMock).toHaveBeenCalledWith(5, "name");
  expect(prefetchMock).toHaveBeenCalledTimes(2);
  expect(prefetchMock).toHaveBeenCalledWith("https://media.example.com/media/a.jpg", "disk");
  expect(prefetchMock).toHaveBeenCalledWith("https://media.example.com/media/b.jpg", "disk");
});

it("skips re-fetching once a territory has already been prefetched", async () => {
  fetchSpeciesMock.mockResolvedValue([species("a.jpg")]);

  await runSpeciesImagePrefetch(5);
  await runSpeciesImagePrefetch(5);

  expect(fetchSpeciesMock).toHaveBeenCalledTimes(1);
});

it("re-fetches when the territory changes", async () => {
  fetchSpeciesMock.mockResolvedValue([species("a.jpg")]);

  await runSpeciesImagePrefetch(5);
  await runSpeciesImagePrefetch(9);

  expect(fetchSpeciesMock).toHaveBeenCalledTimes(2);
  expect(fetchSpeciesMock).toHaveBeenLastCalledWith(9, "name");
});

it("does not re-fetch when switching back to a previously prefetched territory", async () => {
  fetchSpeciesMock.mockResolvedValue([species("a.jpg")]);

  await runSpeciesImagePrefetch(5);
  await runSpeciesImagePrefetch(9);
  await runSpeciesImagePrefetch(5);

  expect(fetchSpeciesMock).toHaveBeenCalledTimes(2);
});

it("does not fail the batch when an individual thumbnail fails to prefetch", async () => {
  fetchSpeciesMock.mockResolvedValueOnce([species("a.jpg"), species("b.jpg")]);
  prefetchMock.mockRejectedValueOnce(new Error("404"));

  await expect(runSpeciesImagePrefetch(5)).resolves.toBeUndefined();
  expect(await AsyncStorage.getItem("species_images_prefetched")).toBe(
    JSON.stringify({ territories: [5] }),
  );
});

it("dedupes concurrent calls for the same territory", async () => {
  let resolveFetch: (value: unknown) => void = () => {};
  fetchSpeciesMock.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveFetch = resolve;
    }),
  );

  const first = runSpeciesImagePrefetch(5);
  const second = runSpeciesImagePrefetch(5);

  resolveFetch([species("a.jpg")]);
  await Promise.all([first, second]);

  expect(fetchSpeciesMock).toHaveBeenCalledTimes(1);
});

it("on a network error, retries with backoff instead of giving up", async () => {
  jest.useFakeTimers();
  fetchSpeciesMock.mockRejectedValueOnce({ isNetworkError: true, message: "boom" });
  fetchSpeciesMock.mockResolvedValueOnce([species("a.jpg")]);

  await runSpeciesImagePrefetch(5);
  expect(fetchSpeciesMock).toHaveBeenCalledTimes(1);

  await jest.advanceTimersByTimeAsync(4000);

  expect(fetchSpeciesMock).toHaveBeenCalledTimes(2);
});

it("stopSpeciesImagePrefetchRetries cancels a pending retry", async () => {
  jest.useFakeTimers();
  fetchSpeciesMock.mockRejectedValueOnce({ isNetworkError: true, message: "boom" });

  await runSpeciesImagePrefetch(5);
  stopSpeciesImagePrefetchRetries();
  await jest.advanceTimersByTimeAsync(60_000);

  expect(fetchSpeciesMock).toHaveBeenCalledTimes(1);
});
