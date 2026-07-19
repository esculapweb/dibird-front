import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import {
  persistQueryClientRestore,
  persistQueryClientSubscribe,
} from "@tanstack/query-persist-client-core";
import type { Query } from "@tanstack/react-query";

import { queryClient } from "./queryClient";

const PERSIST_KEY = "rq-offline-cache";
// Bump whenever a persisted fetch function's response shape changes, so a
// native update doesn't try to hydrate cached data in an incompatible shape.
const PERSIST_BUSTER = "v1";
// Safety ceiling independent of any individual query's own staleTime — a
// cache this old is discarded wholesale rather than trusted at all.
const MAX_AGE = 1000 * 60 * 60 * 24;

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: PERSIST_KEY,
});

// DiarySpecies is editor-context-only data with an explicit staleTime: 0
// (see screens/ObservationEditorScreen.tsx) — it always revalidates on the
// next mount regardless, so persisting it buys nothing.
const shouldDehydrateQuery = (query: Query) =>
  query.queryKey[0] !== "DiarySpecies" && query.state.status === "success";

export const restoreQueryCache = () =>
  persistQueryClientRestore({
    queryClient,
    persister,
    maxAge: MAX_AGE,
    buster: PERSIST_BUSTER,
  });

export const startPersistingQueryCache = () =>
  persistQueryClientSubscribe({
    queryClient,
    persister,
    buster: PERSIST_BUSTER,
    dehydrateOptions: { shouldDehydrateQuery },
  });

export const clearPersistedQueryCache = () => persister.removeClient();
