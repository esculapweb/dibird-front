import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import api from "../../services/api";
import { useApiError } from "../useApiError";
import { useMutationWithTranslation } from "../useMutationWithTranslation";
import { isConnected } from "../../services/sync/networkStatus";
import { runPlaceSync } from "../../services/sync/placeSync";
import * as placeRepository from "../repositories/placeRepository";
import { INVALIDATION_MAP } from "../../util/invalidationMap";
import { AppError, PlaceFormData, PlaceItem } from "../../types";

const PLACE_URL = "/myapi/place2/";

// Place-specific replacements for hooks/useItem.ts's generic useItem /
// useCreateItem / useUpdateItem / useDeleteItem — mirrors
// hooks/Diary/useOfflineDiary.ts. Community keeps using the generic
// (online-only) hooks unchanged.

const invalidatePlaceCaches = (queryClient: ReturnType<typeof useQueryClient>) => {
  INVALIDATION_MAP.Place.update.forEach((key) =>
    queryClient.invalidateQueries({ queryKey: key, exact: false, refetchType: "all" }),
  );
};

export const usePlaceItem = (
  id: number | null | undefined,
  params?: Record<string, unknown>,
  // Item already known from wherever navigation originated (a list card, a
  // just-completed create mutation, ...). Seeds the query cache so the
  // screen renders immediately instead of spinning, and — the part that
  // actually matters offline — gives the query cache "existing" data to fall
  // back to if the detail fetch below fails. Without this, the very first
  // fetch of a given place id has nothing to fall back to and the offline
  // error surfaces even though the item is right there on the list screen
  // the user tapped it from. Mirrors useObservationItem/useDiaryItem.
  initialItem?: PlaceItem | null,
) => {
  const { showErrorToast } = useApiError();

  const query = useQuery({
    queryKey: ["Place", id, params ?? null],
    queryFn: async () => {
      if (id! < 0) {
        const local = placeRepository.getPlace(id!);
        if (!local) throw new Error("Place not found locally");
        return placeRepository.withPendingObservationCount(local);
      }

      try {
        const res = await api.get(`${PLACE_URL}${id}/`, { params });
        placeRepository.upsertFromServer(res.data);
        // Even on a successful live fetch, an observation just created
        // against this place may not have synced yet (its own sync is a
        // separate queue) — fold it in so the count doesn't lag behind what
        // the user just did. See placeRepository.withPendingObservationCount.
        return placeRepository.withPendingObservationCount(res.data);
      } catch (e) {
        // Offline (or any request failure) fallback: the local snapshot may
        // not reflect the currently active date filter (counts are
        // date-scoped server-side) — showing the last-known unfiltered
        // counts is still strictly better than an error screen.
        const local = placeRepository.getPlace(id!);
        if (local) return placeRepository.withPendingObservationCount(local);
        throw e;
      }
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    ...(initialItem && initialItem.id === id
      ? { initialData: initialItem, initialDataUpdatedAt: 0 }
      : {}),
  });

  useEffect(() => {
    if (query.isError && !query.data) {
      showErrorToast(query.error, "usePlaceItem");
    }
  }, [query.isError, query.error, query.data]);

  return query;
};

export const useCreatePlace = () => {
  const queryClient = useQueryClient();

  return useMutationWithTranslation<PlaceItem, AppError, PlaceFormData>({
    mutationFn: async (payload) => {
      const clientRequestId = placeRepository.makeClientRequestId();

      if (isConnected()) {
        try {
          const res = await api.post(PLACE_URL, {
            ...payload,
            client_request_id: clientRequestId,
          });
          placeRepository.upsertFromServer(res.data);
          return res.data;
        } catch (e) {
          const err = e as AppError;
          if (!err.isNetworkError && !err.isTimeout) throw err;
        }
      }

      const item = placeRepository.createLocal(payload, clientRequestId);
      runPlaceSync();
      return item;
    },
    onSettled: () => invalidatePlaceCaches(queryClient),
  });
};

export const useUpdatePlace = (id: number | null | undefined) => {
  const queryClient = useQueryClient();

  return useMutationWithTranslation<PlaceItem, AppError, Partial<PlaceFormData>>({
    mutationFn: async (payload) => {
      if (id == null) throw new Error("Missing place id");

      if (id > 0 && isConnected()) {
        try {
          const res = await api.patch(`${PLACE_URL}${id}/`, payload);
          placeRepository.upsertFromServer(res.data);
          return res.data;
        } catch (e) {
          const err = e as AppError;
          if (!err.isNetworkError && !err.isTimeout) throw err;
        }
      }

      // Unlike Diary/Observation, PlaceDetailScreen's query key includes a
      // date-scoped `params` tuple, so a plain ["Place", id] cache lookup
      // wouldn't reliably match — read the authoritative local snapshot
      // instead (placeRepository.updateLocal already falls back to it when
      // no currentItem is passed, this just skips the redundant RQ lookup).
      const currentItem = placeRepository.getPlace(id);
      const item = placeRepository.updateLocal(id, payload, currentItem);
      if (id > 0) runPlaceSync();
      return item;
    },
    onSettled: () => invalidatePlaceCaches(queryClient),
  });
};

export const useDeletePlace = () => {
  const queryClient = useQueryClient();

  return useMutationWithTranslation<void, AppError, number>({
    mutationFn: async (id: number) => {
      if (id > 0 && isConnected()) {
        try {
          await api.delete(`${PLACE_URL}${id}/`);
          placeRepository.removeLocal(id);
          return;
        } catch (e) {
          const err = e as AppError;
          if (!err.isNetworkError && !err.isTimeout) throw err;
        }
      }

      placeRepository.deleteLocal(id);
      if (id > 0) runPlaceSync();
    },
    onSettled: () => invalidatePlaceCaches(queryClient),
  });
};
