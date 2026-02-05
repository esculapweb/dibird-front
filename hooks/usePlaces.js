import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchPlaces } from "../util/fetches";

import { useLanguage } from "../store/language-context";

export const usePlaces = ({ filters, sort, search }) => {
  const language = useLanguage();
  return useInfiniteQuery({
    queryKey: ["places", filters, sort, search, language],
    queryFn: ({ pageParam = 1 }) =>
      fetchPlaces(filters, sort, search, pageParam),
    getNextPageParam: (lastPage) => {
      const { pagination } = lastPage;
      return pagination.current < pagination.final
        ? pagination.current + 1
        : undefined;
    },
    keepPreviousData: true,
  });
};
