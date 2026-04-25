import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import { useSavedSort } from "./useSavedSort";
import { useApiError } from "./useApiError";
import { sortOptionsList } from "../util/sortOptionsList";
import { AppError } from "../services/api";

interface DropdownItem {
  value: string;
  label: string;
  name_lang?: string;
}

interface UseDropdownQueryProps {
  type: string;
  queryFn: (sort: string) => Promise<DropdownItem[]>;
  params: unknown[];
  enabled?: boolean;
  mapResult?: boolean;
  locationAvailable?: boolean;
  permissionStatus?: string | null;
  onLocationUnavailable?: () => void;
  requestLocation?: () => Promise<unknown>;
}

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
}: UseDropdownQueryProps) => {
  const { sort, loaded, onChange } = useSavedSort(type);
  const { showErrorToast } = useApiError();
  const pendingSortRef = useRef<string | null>(null);

  const isDistanceSort = (val: string) =>
    val === "distance" || val === "-distance";

  const effectiveSort =
    isDistanceSort(sort) && permissionStatus === "denied"
      ? (sortOptionsList(type).find((o) => !isDistanceSort(o.value))?.value ??
        sort)
      : sort;

  const handleSortChange = async (val: string) => {
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
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    select: mapResult
      ? (data) => new Map(data.map((i) => [i.value, i?.name_lang ?? i.label]))
      : undefined,
  });

  useEffect(() => {
    if (query.error) {
      console.warn("Query error:", type, query.error);
      showErrorToast(query.error as AppError);
    }
  }, [query.error]);

  return { query, sort: effectiveSort, onSortChange: handleSortChange };
};
