import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { useApiError } from "./useApiError";
import api from "../services/api";
import { stableStringify } from "../util/helpers";
import {
  cacheListResponse,
  getCachedListResponse,
} from "./repositories/listCacheRepository";
import { communityItemCacheTable } from "../services/db/schema";

const MAX_ENTRIES = 3000;

type ItemType = "Place" | "Observation" | "Community" | "Diary";

const URLS = {
  Place: "/myapi/place2/",
  Observation: "/myapi/observation2/",
  Community: "/myapi/community2/",
  Diary: "/myapi/diary2/",
};

export const useItem = (
  id: string | number | null | undefined,
  type: ItemType,
  params?: Record<string, unknown>,
) => {
  const { showErrorToast } = useApiError();

  // No per-entity local mirror table for these types (unlike Observation/
  // Diary/Place, which have their own offline-first hooks) — just a
  // read-through cache in a dedicated table, same fallback shape as
  // fetchAbstract in util/fetches.ts uses for list responses. Only "Community"
  // actually reaches this path today (Place/Observation/Diary moved to their
  // own repos), hence a single dedicated table rather than one per type.
  const cacheKey = `item|${type}|${id}|${stableStringify(params ?? {})}`;

  const query = useQuery({
    queryKey: [type, id, params ?? null],
    queryFn: async () => {
      try {
        const res = await api.get(`${URLS[type]}${id}/`, { params });
        cacheListResponse(communityItemCacheTable, cacheKey, res.data, MAX_ENTRIES);
        return res.data;
      } catch (e) {
        const cached = getCachedListResponse(communityItemCacheTable, cacheKey);
        if (cached) return cached;
        throw e;
      }
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (query.error) showErrorToast(query.error, `useItem:${type}`);
  }, [query.error]);
  return query;
};
