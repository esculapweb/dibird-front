// Per-query staleTime overrides for data already covered by
// util/invalidationMap.ts (invalidated immediately after the user's own
// mutations) — the global default in services/queryClient.ts stays short
// (10s) for everything that isn't explicitly overridden.
export const StaleTime = {
  TWO_MINUTES: 120_000,
  FIVE_MINUTES: 300_000,
  TEN_MINUTES: 600_000,
  ONE_HOUR: 3_600_000,
  ONE_DAY: 86_400_000,
};
