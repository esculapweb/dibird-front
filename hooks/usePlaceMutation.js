import { useMutationWithTranslation } from './useMutationWithTranslation';
import { useQueryClient } from "@tanstack/react-query";
import api from "../services/api";

export const useUpdatePlace = (id) => {
  const queryClient = useQueryClient();

  return useMutationWithTranslation({
    mutationFn: (data) => {
      return api.patch(`/myapi/place2/${id}/`, data);
    },
    onMutate: async (newData) => {
      await queryClient.cancelQueries(["place", id]);

      const prevPlace = queryClient.getQueryData(["place", id]);
      const prevPlaces = queryClient.getQueryData(["places"]);

      // Глубокая merge
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

      // Обновляем конкретное место
      queryClient.setQueryData(["place", id], (old) => {
        const updated = old ? mergeDeep(old, newData) : old;
        return updated;
      });

      // Обновляем в списке мест
      queryClient.setQueryData(["places"], (old) => {
        if (!old?.results) return old;
        const updated = {
          ...old,
          results: old.results.map((place) =>
            place.id === id ? { ...place, ...newData } : place,
          ),
        };
        return updated;
      });

      return { prevPlace, prevPlaces };
    },
    // onSuccess: (data) => {
    //   console.log("Update successful:", data);
    // },
    onError: (err, newData, ctx) => {
      console.error("Update place error:", err);
      console.error("Failed data:", newData);

      if (ctx?.prevPlace) {
        queryClient.setQueryData(["place", id], ctx.prevPlace);
        console.log("Rolled back place data");
      }
      if (ctx?.prevPlaces) {
        queryClient.setQueryData(["places"], ctx.prevPlaces);
        console.log("Rolled back places list");
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries(["place", id]);
      queryClient.invalidateQueries(["places"]);
    },
  });
};

export const useDeletePlace = () => {
  const queryClient = useQueryClient();

  return useMutationWithTranslation({
    mutationFn: (id) => api.delete(`/myapi/place2/${id}/`),
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries(["places"]);

      await Promise.all([
        queryClient.cancelQueries(["place", deletedId]),
        queryClient.cancelQueries(["places"]),
      ]);

      const prev = queryClient.getQueryData(["places"]);

      const prevPlace = queryClient.getQueryData(["place", deletedId]);
      const prevPlaces = queryClient.getQueryData(["places"]);

      queryClient.removeQueries(["place", deletedId]);

      queryClient.setQueryData(["places"], (old) => {
        if (!old?.results) return old;
        return {
          ...old,
          results: old.results.filter((place) => place.id !== deletedId),
          count: old.count ? old.count - 1 : old.count,
        };
      });

      return { prevPlace, prevPlaces };
    },
    onError: (err, deletedId, ctx) => {
      console.error("Delete place error:", err);
      if (ctx?.prevPlace) {
        queryClient.setQueryData(["place", deletedId], ctx.prevPlace);
      }
      if (ctx?.prevPlaces) {
        queryClient.setQueryData(["places"], ctx.prevPlaces);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries(["places"]);
    },
  });
};

export const useCreatePlace = () => {
  const queryClient = useQueryClient();

  return useMutationWithTranslation({
    mutationFn: (data) => api.post(`/myapi/place2/`, data),
    onSuccess: (data) => {
      queryClient.setQueryData(["places"], (old) => {
        if (!old?.results) return old;
        return {
          ...old,
          results: [data.data, ...old.results],
          count: old.count ? old.count + 1 : old.count,
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries(["places"]);
    },
  });
};
