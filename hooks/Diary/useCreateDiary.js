import { useQueryClient } from "@tanstack/react-query";

import { useMutationWithTranslation } from "../useMutationWithTranslation";
import api from "../../services/api";
import { INVALIDATION_MAP } from "../../constants/invalidationMap";

export const useCreateDiary = () => {
  const queryClient = useQueryClient();

  return useMutationWithTranslation({
    mutationFn: (data) => {
      const formattedData = {
        territory: data.territory,
        place: data.place ?? null,
        date_time: data.date_time,
        private: data.private ?? false,
        name: data.notes ?? "",
      };

      return api.post(`/myapi/diary2/`, formattedData);
    },
    onSuccess: (response) => {
      queryClient.setQueryData(["Diaries"], (old) => {
        if (!old?.results) return old;
        return {
          ...old,
          results: [response.data, ...old.results],
          count: old.count ? old.count + 1 : old.count,
        };
      });
    },
    onSettled: () => {
      const extraKeys = INVALIDATION_MAP["Diary"]?.add ?? [];
      extraKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key, exact: false });
      });
    },
  });
};
