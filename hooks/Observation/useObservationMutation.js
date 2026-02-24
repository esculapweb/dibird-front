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
