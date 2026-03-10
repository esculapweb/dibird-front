import { useQuery } from "@tanstack/react-query";
import { useApiError } from "./useApiError";

const useQueryWithTranslation = (options) => {
  const { getTranslatedError, showErrorToast } = useApiError();

  return useQuery({
    ...options,
    onError: (error, ...args) => {
      console.info("Query error:", {
        queryKey: options.queryKey,
        error: getTranslatedError(error),
      });

      if (options.showErrorToast !== false) {
        showErrorToast(error);
      }

      if (options.onError) {
        options.onError(error, ...args);
      }
    },
  });
};

export const useTranslatedQuery = ({
  queryFn,
  params = [],
  type,
  options = {},
  mapResult = false,
}) => {
  return useQueryWithTranslation({
    queryKey: [type ?? queryFn.name, ...params],
    queryFn: () => queryFn(params[0]),
    staleTime: 1000 * 60 * 60 * 24,
    cacheTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    select: mapResult
      ? (data) =>
          new Map(
            data.map((item) => [item.value, item?.name_lang ?? item.label]),
          )
      : undefined,
    ...options,
  });
};
