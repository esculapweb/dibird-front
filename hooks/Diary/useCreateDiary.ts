import { useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";

import { useMutationWithTranslation } from "../useMutationWithTranslation";
import { INVALIDATION_MAP } from "../../util/invalidationMap";

import { DiaryFormData, DiaryItem } from "../../types";
import { createDiary } from "../../util/fetches";

export const useCreateDiary = () => {
  const queryClient = useQueryClient();

  return useMutationWithTranslation({
    mutationFn: (data: DiaryFormData) => {
      const formattedData = {
        territory: data.territory,
        place: data.place ?? null,
        date_time: data.date_time,
        private: data.private ?? false,
        name: data.name ?? "",
      };

      return createDiary(formattedData);
    },
    onSuccess: (response: AxiosResponse<DiaryItem>) => {
      queryClient.setQueryData(
        ["Diaries"],
        (old: Record<string, unknown> | undefined) => {
          if (!old?.results) return old;
          const results = old.results as unknown[];

          return {
            ...old,
            results: [response.data, ...results],
            count: typeof old.count === "number" ? old.count + 1 : old.count,
          };
        },
      );
    },
    onSettled: () => {
      const extraKeys = INVALIDATION_MAP["Diary"]?.add ?? [];
      extraKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key, exact: false });
      });
    },
  });
};
