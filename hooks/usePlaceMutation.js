import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../services/api";

export const useToggleFavourite = (id) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (favourite) => api.patch(`/myapi/place2/${id}/`, { favourite }),
    onMutate: async (newFav) => {
      await queryClient.cancelQueries(["place", id]);

      const prev = queryClient.getQueryData(["place", id]);

      queryClient.setQueryData(["place", id], (old) =>
        old ? { ...old, favourite: newFav } : old,
      );

      return { prev };
    },
    onError: (_err, _newFav, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(["place", id], ctx.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries(["places"]);
    },
  });
};

export const useDeletePlace = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => api.delete(`/myapi/place2/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries(["places"]);
    },
  });
};
