import { useState, useEffect } from "react";
import { loadSort, saveSort } from "../util/storageHelper";
import { useTranslatedQuery } from "./useQueryWithTranslation";
import { sortOptionsList } from "../util/sortOptionsList";

export const useSortedQuery = ({ type, queryFn, params, enabled = true, ...rest }) => {
  const defaultSort = type ? (sortOptionsList(type)[0]?.value ?? null) : null;
  const [sort, setSort] = useState(defaultSort);
  const [sortLoaded, setSortLoaded] = useState(false);

  useEffect(() => {
    if (!type) {
      setSortLoaded(true);
      return;
    }
    loadSort(type).then((val) => {
      setSort(val ?? defaultSort);
      setSortLoaded(true);
    });
  }, [type]);

  const query = useTranslatedQuery({
    queryFn: () => queryFn(sort),
    params: [...params, sort],
    type,
    enabled: enabled && sortLoaded,
    ...rest,
  });

  const handleSortChange = async (val) => {
    setSort(val);
    if (type) await saveSort(type, val);
  };

  return { query, sort, onSortChange: handleSortChange };
};