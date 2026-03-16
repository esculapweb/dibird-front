import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useMutationWithTranslation } from "./useMutationWithTranslation";
import { useApiError } from "./useApiError";
import api from "../services/api";
import { INVALIDATION_MAP } from "../constants/invalidationMap";

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

export const useItem = (id, type) => {
  const { getTranslatedError, showErrorToast } = useApiError();

  return useQuery({
    queryKey: [type, id],
    queryFn: async () => {
      const res = await api.get(`${URLS[type]}${id}/`);
      return res.data;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 60 * 24,
    cacheTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    onError: (error) => {
      console.info("Query error:", {
        queryKey: [type, id],
        error: getTranslatedError(error),
      });
      showErrorToast(error);
    },
  });
};

export const useUpdateItem = (id, type) => {
  const queryClient = useQueryClient();

  return useMutationWithTranslation({
    mutationFn: (data) => {
      return api.patch(`${URLS[type]}${id}/`, data);
    },
    onMutate: async (newData) => {
      await queryClient.cancelQueries([type, id]);

      const prevItem = queryClient.getQueryData([type, id]);
      const prevItems = queryClient.getQueryData([TYPE_PLURAL[type]]);

      const mergeDeep = (old, updates) => {
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
            result[key] = mergeDeep(old[key], updates[key]);
          } else {
            result[key] = updates[key];
          }
        });

        return result;
      };

      queryClient.setQueryData([type, id], (old) => {
        const updated = old ? mergeDeep(old, newData) : old;
        return updated;
      });

      queryClient.setQueryData([`${TYPE_PLURAL[type]}`], (old) => {
        if (!old?.results) return old;
        const updated = {
          ...old,
          results: old.results.map((item) =>
            item.id === id ? { ...item, ...newData } : item,
          ),
        };
        return updated;
      });

      return { prevItem, prevItems };
    },
    onError: (e, newData, ctx) => {
      if (ctx?.prevItem) {
        queryClient.setQueryData([type, id], ctx.prevItem);
      }
      if (ctx?.prevItems) {
        queryClient.setQueryData([TYPE_PLURAL[type]], ctx.prevItems);
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

export const useDeleteItem = (type) => {
  const queryClient = useQueryClient();

  return useMutationWithTranslation({
    mutationFn: (id) => api.delete(`${URLS[type]}${id}/`),
    onSettled: (data, error, id) => {
      queryClient.removeQueries({ queryKey: [type, id], exact: true });
      const extraKeys = INVALIDATION_MAP[type]?.delete ?? [];
      extraKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key, exact: false });
      });
    },
  });
};
