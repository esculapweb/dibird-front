import { useQuery } from "@tanstack/react-query";
import { useSavedSort } from "./useSavedSort";
import { useApiError } from "./useApiError";

export const useDropdownQuery = ({
  type,
  queryFn,
  params,
  enabled = true,
  mapResult = false,
}) => {
  const { sort, loaded, onChange } = useSavedSort(type);
  const { getTranslatedError, showErrorToast } = useApiError();

  const query = useQuery({
    queryKey: [type, ...params, sort],
    queryFn: () => queryFn(sort),
    enabled: enabled !== false && !!loaded,
    staleTime: 1000 * 60 * 60 * 24,
    cacheTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    select: mapResult
      ? (data) => new Map(data.map((i) => [i.value, i?.name_lang ?? i.label]))
      : undefined,
    onError: (error) => {
      console.info("Query error:", {
        queryKey: [type, ...params, sort],
        error: getTranslatedError(error),
      });
      showErrorToast(error);
    },
  });

  return { query, sort, onSortChange: onChange };
};