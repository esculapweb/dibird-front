import { useInfiniteQuery } from "@tanstack/react-query";
import { useLanguage } from "../store/language-context";

export const useList = ({
  entityKey,
  fetchFunction,
  filters,
  sort,
  search,
}) => {
  const {language} = useLanguage();
  return useInfiniteQuery({
    queryKey: [entityKey, JSON.stringify(filters), sort, search, language],
    queryFn: ({ pageParam = 1 }) =>
      fetchFunction(filters, sort, search, pageParam),
    getNextPageParam: (lastPage) => {
      const { pagination } = lastPage;
      return pagination.current < pagination.final
        ? pagination.current + 1
        : undefined;
    },
    keepPreviousData: true,
  });
};
