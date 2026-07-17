import { queryClient } from "../queryClient";

// Coalesces the invalidations fired by a reconnect-triggered sync cascade
// (observationSync/diarySync/placeSync/notificationSync, plus the "wake the
// other queue" calls they make on each other — see placeSync.ts's create
// branch calling runObservationSync()/runDiarySync(), and diarySync.ts's
// create branch calling runObservationSync()) into a single invalidateQueries
// call per unique key, instead of one sweep per mutation processed.
//
// activeCount relies on a JS-semantics guarantee: an async function runs
// synchronously up to its first await. When one sync pass wakes another
// (e.g. placeSync calling runObservationSync()), that call's beginSyncPass()
// runs synchronously before control returns to the waking pass — so
// activeCount is already incremented by the time the waking pass's own
// finally() later decrements it. That's what keeps the count from hitting
// zero (and flushing early) while a woken pass is still in flight. Do not
// insert an await before a beginSyncPass()/wake call, or this invariant
// breaks.
let activeCount = 0;
const pending = new Map<string, unknown[]>();

export const beginSyncPass = () => {
  activeCount++;
};

export const endSyncPass = () => {
  activeCount = Math.max(0, activeCount - 1);
  if (activeCount === 0) flush();
};

// Queues a batch of query keys to invalidate once the whole sync cascade
// (not just the current mutation) has finished, deduping repeats across
// mutations/modules by their serialized key.
export const queueInvalidation = (keys: unknown[][]) => {
  keys.forEach((key) => pending.set(JSON.stringify(key), key));
};

const flush = () => {
  if (pending.size === 0) return;
  const keys = [...pending.values()];
  pending.clear();
  keys.forEach((queryKey) =>
    queryClient.invalidateQueries({ queryKey, exact: false, refetchType: "all" }),
  );
};
