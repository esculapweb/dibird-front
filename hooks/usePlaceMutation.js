import { useMutationWithTranslation } from "./useMutationWithTranslation";
import { useQueryClient } from "@tanstack/react-query";
import api from "../services/api";

export const useCreatePlace = () => {
  const queryClient = useQueryClient();

  return useMutationWithTranslation({
    mutationFn: (data) => {
      const formattedData = {
        name: data.name,
        favourite: data.favourite || false,
        territory: data.territory,
      };

      if (data.location && data.location.coordinates) {
        formattedData.location = {
          type: "Point",
          coordinates: [
            Number(data.location.coordinates[0]), // longitude
            Number(data.location.coordinates[1]), // latitude
          ],
        };
      }
      return api.post(`/myapi/place2/`, formattedData);
    },
    onSuccess: (response) => {
      queryClient.setQueryData(["places"], (old) => {
        if (!old?.results) return old;
        return {
          ...old,
          results: [response.data, ...old.results],
          count: old.count ? old.count + 1 : old.count,
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries(["places"]);
    },
  });
};

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

      queryClient.setQueryData(["place", id], (old) => {
        const updated = old ? mergeDeep(old, newData) : old;
        return updated;
      });

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
    onError: (e, newData, ctx) => {
      if (ctx?.prevPlace) {
        queryClient.setQueryData(["place", id], ctx.prevPlace);
      }
      if (ctx?.prevPlaces) {
        queryClient.setQueryData(["places"], ctx.prevPlaces);
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
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["places"],
        exact: false,
      });
    },
  });
};
