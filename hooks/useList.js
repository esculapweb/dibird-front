import { useInfiniteQuery } from "@tanstack/react-query";
import { useLanguage } from "../store/language-context";

export const useList = ({
  screenName,
  fetchFunction,
  filters,
  sort,
  search,
  tabsMode,
  extraFilters
}) => {
  const {language} = useLanguage();

  const mergedFilters = extraFilters 
    ? { ...(filters ?? {}), ...extraFilters }
    : filters;

  return useInfiniteQuery({
    queryKey: [screenName, JSON.stringify(mergedFilters), sort, search, tabsMode, language],
    queryFn: ({ pageParam = 1 }) =>
      fetchFunction(mergedFilters, sort, search, pageParam),
    getNextPageParam: (lastPage) => {
      const { pagination } = lastPage;
      return pagination.current < pagination.final
        ? pagination.current + 1
        : undefined;
    },
    keepPreviousData: true,
    staleTime: 1000 * 60,      
    refetchOnWindowFocus: false,
  });
};
