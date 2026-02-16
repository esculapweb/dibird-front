import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchObservations } from "../../util/fetches";

import { useLanguage } from "../../store/language-context";

export const useObservations = ({ filters, sort, search }) => {
  const language = useLanguage();
  return useInfiniteQuery({
    queryKey: ["observations", filters, sort, search, language],
    queryFn: ({ pageParam = 1 }) =>
      fetchObservations(filters, sort, search, pageParam),
    getNextPageParam: (lastPage) => {
      const { pagination } = lastPage;
      return pagination.current < pagination.final
        ? pagination.current + 1
        : undefined;
    },
    keepPreviousData: true,
  });
};
