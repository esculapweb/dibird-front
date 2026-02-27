import { useQueryClient } from "@tanstack/react-query";

import { useMutationWithTranslation } from "../useMutationWithTranslation";
import api from "../../services/api";

export const useCreateObservation = () => {
  const queryClient = useQueryClient();

  return useMutationWithTranslation({
    mutationFn: (data) => {
      const formattedData = {
        species: data.species,
        territory: data.territory,
        place: data.place ?? null,
        date_time: data.date_time,
        time: data.time ?? null,
        private: data.private ?? false,
        quantity: data.quantity ?? null,
        notes: data.notes ?? "",
      };

      return api.post(`/myapi/observation2/`, formattedData);
    },
    onSuccess: (response) => {
      queryClient.setQueryData(["Observations"], (old) => {
        if (!old?.results) return old;
        return {
          ...old,
          results: [response.data, ...old.results],
          count: old.count ? old.count + 1 : old.count,
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries(["Observations"]);
    },
  });
};
