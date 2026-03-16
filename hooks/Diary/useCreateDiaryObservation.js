import { useQueryClient } from "@tanstack/react-query";

import { useMutationWithTranslation } from "../useMutationWithTranslation";
import api from "../../services/api";

export const useCreateDiaryObservation = () => {
  const queryClient = useQueryClient();

  return useMutationWithTranslation({
    mutationFn: (data) => {
      const formattedData = {
        species: data.species,
        diary: data.diary,
        time: data.time ?? null,
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
      queryClient.invalidateQueries(["Diaries"]);
    },
  });
};
