import { useState, useEffect } from "react";
import { loadSort, saveSort } from "../util/storageHelper";
import { sortOptionsList } from "../util/sortOptionsList";
import { normalizeValue } from "../util/helpers";

export const useSavedSort = (type: string) => {
  const defaultSort = sortOptionsList(type)[0]?.value ?? null;
  const [sort, setSort] = useState<string>(defaultSort);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadSort(type).then((val) => {
      const validValues = sortOptionsList(type).map((i) => i.value);
      setSort(normalizeValue(val as string | null, validValues) ?? defaultSort);
      setLoaded(true);
    });
  }, [type]);

  const onChange = async (val: string): Promise<void> => {
    setSort(val);
    await saveSort(type, val);
  };

  return { sort, loaded, onChange };
};
