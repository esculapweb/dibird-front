import { useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";

import { useMutationWithTranslation } from "../useMutationWithTranslation";
import api from "../../services/api";
import { INVALIDATION_MAP } from "../../util/invalidationMap";
import { ObservationFormData, ObservationItem } from "../../types";

export const useCreateObservation = () => {
  const queryClient = useQueryClient();

  return useMutationWithTranslation({
    mutationFn: (data: ObservationFormData) => {
      const isDiary = !!data.diary;

      const formattedData = isDiary
        ? {
            species: data.species,
            diary: data.diary,
            time: data.time ?? null,
            quantity: data.quantity ?? null,
            notes: data.notes ?? "",
          }
        : {
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
    onSuccess: (response: AxiosResponse<ObservationItem>) => {
      queryClient.setQueryData(["Observations"], (old: Record<string, unknown> | undefined) => {
        if (!old?.results) return old;
        const results = old.results as unknown[];
        return {
          ...old,
            results: [(response as any).data, ...results],
            count: typeof old.count === "number" ? old.count + 1 : old.count,
        };
      });
    },
    onSettled: () => {
      const extraKeys = INVALIDATION_MAP["Observation"]?.add ?? [];
      extraKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key, exact: false });
      });
    },
  });
};
