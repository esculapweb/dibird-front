import { useQuery } from "@tanstack/react-query";

import { fetchMyActivity } from "../util/fetches";
import { StaleTime } from "../constants/staleTime";
import { ActivityMode, Filters } from "../types";

// Shared by the main-screen Sparkline and ActivityScreen: the same key means
// opening the full chart from the card is served from cache, not refetched.
export const useActivity = (filters: Filters, mode: ActivityMode) =>
  useQuery({
    queryKey: [
      "Activity",
      filters?.territory ?? null,
      filters?.date?.type ?? null,
      filters?.date?.year ?? null,
      filters?.date?.from ?? null,
      filters?.date?.to ?? null,
      mode,
    ],
    queryFn: () =>
      fetchMyActivity({
        ...filters,
        ...(mode === "newSpecies" && { new: true }),
      }),

    enabled: !!filters,
    staleTime: StaleTime.FIVE_MINUTES,
  });
