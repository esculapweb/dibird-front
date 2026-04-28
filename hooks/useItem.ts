import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useMutationWithTranslation } from "./useMutationWithTranslation";
import { useApiError } from "./useApiError";
import api from "../services/api";
import { INVALIDATION_MAP } from "../util/invalidationMap";
import { AppError } from "../types";

type ItemType = "Place" | "Observation" | "Diary";

interface UpdateContext {
  prevItem: unknown;
  prevItems: unknown;
}

const URLS = {
  Place: "/myapi/place2/",
  Observation: "/myapi/observation2/",
  Diary: "/myapi/diary2/",
};

const TYPE_PLURAL = {
  Place: "Places",
  Observation: "Observations",
  Diary: "Diaries",
};

export const useItem = (id: string | number | null | undefined, type: ItemType) => {
  const { showErrorToast } = useApiError();

  const query = useQuery({
    queryKey: [type, id],
    queryFn: async () => {
      const res = await api.get(`${URLS[type]}${id}/`);
      return res.data;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (query.error) showErrorToast(query.error as AppError);
  }, [query.error]);
  return query;
};

export const useUpdateItem = (
  id: number | null | undefined,
  type: ItemType,
) => {
  const queryClient = useQueryClient();

  return useMutationWithTranslation({
    mutationFn: (data) => {
      return api.patch(`${URLS[type]}${id}/`, data);
    },
    onMutate: async (newData): Promise<UpdateContext> => {
      await queryClient.cancelQueries({ queryKey: [type, id] });

      const prevItem = queryClient.getQueryData([type, id]);
      const prevItems = queryClient.getQueryData([TYPE_PLURAL[type]]);

      const mergeDeep = (
        old: Record<string, unknown>,
        updates: Record<string, unknown>,
      ): Record<string, unknown> => {
        if (!old) return updates;

        const result = { ...old };

        Object.keys(updates).forEach((key) => {
          if (
            updates[key] !== null &&
            typeof updates[key] === "object" &&
            !Array.isArray(updates[key]) &&
            old[key] !== null &&
            typeof old[key] === "object"
          ) {
            result[key] = mergeDeep(
              old[key] as Record<string, unknown>,
              updates[key] as Record<string, unknown>,
            );
          } else {
            result[key] = updates[key];
          }
        });

        return result;
      };

      queryClient.setQueryData(
        [type, id],
        (old: Record<string, unknown> | undefined) => {
          const updated = old
            ? mergeDeep(
                old as Record<string, unknown>,
                newData as Record<string, unknown>,
              )
            : old;
          return updated;
        },
      );

      queryClient.setQueryData(
        [`${TYPE_PLURAL[type]}`],
        (old: Record<string, unknown> | undefined) => {
          if (!old?.results) return old;
          const results = old.results as Array<Record<string, unknown>>;
          const updated = {
            ...old,
            results: results.map((item) =>
              item.id === id
                ? { ...item, ...(newData as Record<string, unknown>) }
                : item,
            ),
          };
          return updated;
        },
      );
      return { prevItem, prevItems };
    },
    onError: (e, newData, ctx) => {
      const context = ctx as UpdateContext | undefined;
      if (context?.prevItem) {
        queryClient.setQueryData([type, id], context.prevItem);
      }
      if (context?.prevItems) {
        queryClient.setQueryData([TYPE_PLURAL[type]], context.prevItems);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [type, id], exact: true });
      const extraKeys = INVALIDATION_MAP[type]?.update ?? [];
      extraKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key, exact: false });
      });
    },
  });
};

export const useDeleteItem = (type: ItemType) => {
  const queryClient = useQueryClient();

  return useMutationWithTranslation({
    mutationFn: (id: number) => api.delete(`${URLS[type]}${id}/`),
    onSettled: (_data, _error, id) => {
      queryClient.removeQueries({ queryKey: [type, id], exact: true });
      const extraKeys = INVALIDATION_MAP[type]?.delete ?? [];
      extraKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key, exact: false });
      });
    },
  });
};
