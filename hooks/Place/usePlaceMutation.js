import { useQueryClient } from "@tanstack/react-query";

import { useMutationWithTranslation } from "../useMutationWithTranslation";
import api from "../../services/api";

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
      queryClient.setQueryData(["Places"], (old) => {
        if (!old?.results) return old;
        return {
          ...old,
          results: [response.data, ...old.results],
          count: old.count ? old.count + 1 : old.count,
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries(["Places"]);
    },
  });
};
