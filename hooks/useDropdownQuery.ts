import { useEffect, useRef } from "react";
import { useQuery, UseQueryResult } from "@tanstack/react-query";

import { useSavedSort } from "./useSavedSort";
import { sortOptionsList } from "../util/sortOptionsList";
import { subscribeToReconnect } from "../services/sync/networkStatus";
import { DropdownItem, AppError } from "../types";

interface UseDropdownQueryProps<T extends DropdownItem = DropdownItem> {
  type: string;
  queryFn: (sort: string) => Promise<T[]>;
  params: unknown[];
  enabled?: boolean;
  mapResult?: boolean;
  locationAvailable?: boolean;
  permissionStatus?: string | null;
  onLocationUnavailable?: () => void;
  requestLocation?: () => Promise<unknown>;
}

export function useDropdownQuery<T extends DropdownItem = DropdownItem>(
  props: UseDropdownQueryProps<T> & { mapResult: true },
): {
  query: UseQueryResult<Map<string | number, string>, AppError>;
  sort: string;
  onSortChange: (val: string) => Promise<void>;
};

export function useDropdownQuery<T extends DropdownItem = DropdownItem>(
  props: UseDropdownQueryProps<T> & { mapResult?: false },
): {
  query: UseQueryResult<T[], AppError>;
  sort: string;
  onSortChange: (val: string | number | boolean | null) => Promise<void>;
};

export function useDropdownQuery<T extends DropdownItem = DropdownItem>({
  type,
  queryFn,
  params,
  enabled = true,
  mapResult = false,
  locationAvailable = true,
  permissionStatus,
  onLocationUnavailable,
  requestLocation,
}: UseDropdownQueryProps<T>) {
  const { sort, loaded, onChange } = useSavedSort(type);
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

  const query = useQuery<
    DropdownItem[],
    AppError,
    DropdownItem[] | Map<string | number, string>
  >({
    queryKey: [type, ...params, effectiveSort],
    queryFn: () => queryFn(effectiveSort),
    enabled: enabled !== false && !!loaded,
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
    select: mapResult
      ? (data) => new Map(data.map((i) => [i.value, i?.name_lang ?? i.label]))
      : undefined,
  });

  // "distance"/"-distance" can't be reproduced offline (no stored device
  // position), so a sort change made while offline is served from a stale
  // cache entry rather than the actual requested order — see fetchMyPlaces'
  // offline fallback in util/fetches.ts. Force a real refetch once
  // connectivity returns so the list catches up to the sort the user already
  // picked, instead of silently sitting on that stale order until the 24h
  // staleTime expires. query.refetch is intentionally left out of the deps —
  // it's a stable method on the underlying observer, so re-subscribing only
  // when effectiveSort changes (not on every render) is enough.
  useEffect(() => {
    if (!isDistanceSort(effectiveSort)) return undefined;
    return subscribeToReconnect(() => {
      query.refetch();
    });
  }, [effectiveSort]);

  return { query, sort: effectiveSort, onSortChange: handleSortChange };
}
