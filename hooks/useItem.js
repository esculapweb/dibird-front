import { useQueryClient } from "@tanstack/react-query";

import { useTranslatedQuery } from "./useQueryWithTranslation";
import { useMutationWithTranslation } from "./useMutationWithTranslation";
import api from "../services/api";

const URLS = {
  Place: "/myapi/place2/",
  Observation: "/myapi/observation2/",
  Diary: "/myapi/diary2/",
};

const TYPE_PLURAL = {
  Place: "Places",
  Observation: "Observations",
  Diary: "Diaries",
}

export const useItem = (id, type) =>
  useTranslatedQuery({
    queryFn: async (itemId) => {
      const res = await api.get(`${URLS[type]}${itemId}/`);
      return res.data;
    },
    params: [id],
    type,
    enabled: !!id,
  });

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
      if (ctx?.prevItems) {
        queryClient.setQueryData([`${TYPE_PLURAL[type]}`, id], ctx.prevItem);
      }
      if (ctx?.prevItems) {
        queryClient.setQueryData([type], ctx.prevItems);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries([type, id]);
      queryClient.invalidateQueries([`${TYPE_PLURAL[type]}`]);
    },
  });
};

export const useDeleteItem = (type) => {
  const queryClient = useQueryClient();

  return useMutationWithTranslation({
    mutationFn: (id) => api.delete(`${URLS[type]}${id}/`),
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: [`${TYPE_PLURAL[type]}`],
        exact: false,
      });
    },
  });
};
