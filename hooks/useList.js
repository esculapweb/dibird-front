import { useInfiniteQuery } from "@tanstack/react-query";
import { useLanguage } from "../store/language-context";

export const useList = ({
  screenName,
  fetchFunction,
  filters,
  sort,
  search,
  seenMode
}) => {
  const {language} = useLanguage();
  return useInfiniteQuery({
    queryKey: [screenName, JSON.stringify(filters), sort, search, seenMode, language],
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
