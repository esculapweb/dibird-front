import { useState, useEffect } from "react";
import { loadSort, saveSort } from "../util/storageHelper";
import { sortOptionsList } from "../util/sortOptionsList";

export const useSavedSort = (type) => {
  const defaultSort = sortOptionsList(type)[0]?.value ?? null;
  const [sort, setSort] = useState(defaultSort);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadSort(type).then((val) => {
      setSort(val ?? defaultSort);
      setLoaded(true);
    });
  }, [type]);

  const onChange = async (val) => {
    setSort(val);
    await saveSort(type, val);
  };

  return { sort, loaded, onChange };
};