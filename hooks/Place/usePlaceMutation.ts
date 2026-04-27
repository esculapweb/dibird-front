import { useQueryClient } from "@tanstack/react-query";

import { useMutationWithTranslation } from "../useMutationWithTranslation";
import api from "../../services/api";
import { INVALIDATION_MAP } from "../../util/invalidationMap";
import { PlaceFormData } from "../../types";

export const useCreatePlace = () => {
  const queryClient = useQueryClient();

  return useMutationWithTranslation({
    mutationFn: (data: PlaceFormData) => {
      const formattedData: PlaceFormData = {
        name: data.name,
        favourite: data.favourite || false,
        territory: data.territory,
      };

      if (data.location && data.location.coordinates) {
        formattedData.location = {
          type: "Point",
          coordinates: [
            Number(data.location.coordinates[0]), 
            Number(data.location.coordinates[1]),
          ],
        };
      }
      return api.post(`/myapi/place2/`, formattedData);
    },
    onSuccess: (response) => {
      queryClient.setQueryData(
        ["Places"],
        (old: Record<string, unknown> | undefined) => {
          if (!old?.results) return old;
          const results = old.results as unknown[];
          return {
            ...old,
            results: [(response as any).data, ...results],
            count: typeof old.count === "number" ? old.count + 1 : old.count,
          };
        },
      );
    },
    onSettled: () => {
      const extraKeys = INVALIDATION_MAP["Place"]?.add ?? [];
      extraKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key, exact: false });
      });
    },
  });
};
