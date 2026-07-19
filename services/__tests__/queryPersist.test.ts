// AsyncStorage's native module isn't available under plain jest-expo (see
// util/__tests__/storageHelper.test.ts's identical mock) — irrelevant here
// anyway, since createAsyncStoragePersister itself is mocked below.
jest.mock("@react-native-async-storage/async-storage", () => ({}));

// Each mock below forwards through a wrapper rather than referencing the
// mockXxx const directly in the object literal: import-derived requires get
// hoisted above these top-level const initializers (unlike a plain
// require()), so a factory that captures mockXxx's value immediately would
// permanently bake in `undefined`. Deferring the read to call time (inside
// the wrapper) sidesteps that — by the time anything actually calls in, the
// const has long since been assigned.
const mockRemoveClient = jest.fn(async () => {});
jest.mock("@tanstack/query-async-storage-persister", () => ({
  createAsyncStoragePersister: jest.fn(() => ({
    removeClient: () => mockRemoveClient(),
  })),
}));

const mockPersistQueryClientRestore = jest.fn(async (_opts: unknown) => {});
const mockPersistQueryClientSubscribe = jest.fn((_opts: unknown) => jest.fn());
jest.mock("@tanstack/query-persist-client-core", () => ({
  persistQueryClientRestore: (opts: unknown) => mockPersistQueryClientRestore(opts),
  persistQueryClientSubscribe: (opts: unknown) => mockPersistQueryClientSubscribe(opts),
}));

jest.mock("../queryClient", () => ({ queryClient: {} }));

import { queryClient } from "../queryClient";
import {
  restoreQueryCache,
  startPersistingQueryCache,
  clearPersistedQueryCache,
} from "../queryPersist";

beforeEach(() => {
  jest.clearAllMocks();
});

it("restores with the queryClient, persister, a busted version, and a 24h max age", async () => {
  await restoreQueryCache();

  expect(mockPersistQueryClientRestore).toHaveBeenCalledWith(
    expect.objectContaining({
      queryClient,
      buster: "v1",
      maxAge: 1000 * 60 * 60 * 24,
    }),
  );
});

it("subscribes with a shouldDehydrateQuery that excludes only DiarySpecies", () => {
  startPersistingQueryCache();

  const call = mockPersistQueryClientSubscribe.mock.calls[0][0] as {
    dehydrateOptions?: {
      shouldDehydrateQuery?: (q: { queryKey: unknown[]; state?: { status: string } }) => boolean;
    };
  };
  const shouldDehydrateQuery = call.dehydrateOptions?.shouldDehydrateQuery;
  expect(shouldDehydrateQuery).toBeDefined();

  expect(shouldDehydrateQuery!({ queryKey: ["DiarySpecies", 1] })).toBe(false);
  expect(shouldDehydrateQuery!({ queryKey: ["Places"], state: { status: "success" } })).toBe(true);
  expect(shouldDehydrateQuery!({ queryKey: ["DashboardStat"], state: { status: "success" } })).toBe(true);
});

it("clears the persisted cache via the persister", async () => {
  await clearPersistedQueryCache();
  expect(mockRemoveClient).toHaveBeenCalledTimes(1);
});
