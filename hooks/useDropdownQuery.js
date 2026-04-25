import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSavedSort } from "./useSavedSort";
import { useApiError } from "./useApiError";
import { sortOptionsList } from "../util/sortOptionsList";

export const useDropdownQuery = ({
  type,
  queryFn,
  params,
  enabled = true,
  mapResult = false,
  locationAvailable = true,
  permissionStatus,
  onLocationUnavailable,
  requestLocation,
}) => {
  const { sort, loaded, onChange } = useSavedSort(type);
  const { showErrorToast } = useApiError();
  const pendingSortRef = useRef(null);

  const isDistanceSort = (val) => val === "distance" || val === "-distance";

  const effectiveSort =
    isDistanceSort(sort) && permissionStatus === "denied"
      ? (sortOptionsList(type).find((o) => !isDistanceSort(o.value))?.value ??
        sort)
      : sort;


  const handleSortChange = async (val) => {
    if (isDistanceSort(val)) {
      if (permissionStatus === "denied") {
        onLocationUnavailable?.();
        return;
      }
      if (
        permissionStatus === "undetermined" ||
        permissionStatus === null ||
        !locationAvailable
      ) {
        pendingSortRef.current = val;
        await requestLocation?.();
        return;
      }
    }
    await onChange(val);
  };

  useEffect(() => {
    if (locationAvailable && pendingSortRef.current) {
      onChange(pendingSortRef.current);
      pendingSortRef.current = null;
    }
  }, [locationAvailable]);

  const query = useQuery({
    queryKey: [type, ...params, effectiveSort],
    queryFn: () => queryFn(effectiveSort),
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
      console.warn("Query error:", type, error);
      showErrorToast(error);
    },
  });

  return { query, sort: effectiveSort, onSortChange: handleSortChange };
};
