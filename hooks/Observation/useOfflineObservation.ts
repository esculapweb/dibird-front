import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import api from "../../services/api";
import { useApiError } from "../useApiError";
import { useMutationWithTranslation } from "../useMutationWithTranslation";
import { useProfile } from "../../store/profile-context";
import { isConnected } from "../../services/sync/networkStatus";
import { runObservationSync } from "../../services/sync/observationSync";
import * as observationRepository from "../repositories/observationRepository";
import { INVALIDATION_MAP } from "../../util/invalidationMap";
import {
  AppError,
  ObservationFormData,
  ObservationItem,
  PlaceDropdownItem,
  SpeciesDropdownItem,
} from "../../types";

const OBSERVATION_URL = "/myapi/observation2/";

// Observation-specific replacements for hooks/useItem.ts's generic useItem /
// useCreateItem / useUpdateItem / useDeleteItem — used only by
// ObservationDetailScreen and ObservationEditorScreen so Place/Community/Diary
// keep using the generic (online-only) hooks unchanged.

const invalidateObservationCaches = (queryClient: ReturnType<typeof useQueryClient>) => {
  // ["Observation"] (no id) is included here with exact:false, which prefix-matches
  // ["Observation", anyId] too, so a single shared list covers add/update/delete.
  // refetchType: "all" so this also refreshes the Observations list even if it
  // happens to be unmounted (useList has refetchOnMount disabled).
  INVALIDATION_MAP.Observation.update.forEach((key) =>
    queryClient.invalidateQueries({ queryKey: key, exact: false, refetchType: "all" }),
  );
};

export const useObservationItem = (id: number | null | undefined) => {
  const { showErrorToast } = useApiError();

  const query = useQuery({
    queryKey: ["Observation", id],
    // Deliberately untyped (matches the generic useItem this replaces): the
    // real API response and ObservationItem drift in a few display-only fields
    // (e.g. diary_data) that aren't worth reconciling as part of this change.
    queryFn: async () => {
      // Temp ids from an unsynced offline create never exist server-side.
      if (id! < 0) {
        const local = observationRepository.getObservation(id!);
        if (!local) throw new Error("Observation not found locally");
        return local;
      }

      try {
        const res = await api.get(`${OBSERVATION_URL}${id}/`);
        observationRepository.upsertFromServer(res.data);
        return res.data;
      } catch (e) {
        const local = observationRepository.getObservation(id!);
        if (local) return local;
        throw e;
      }
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (query.error) showErrorToast(query.error, "useObservationItem");
  }, [query.error]);

  return query;
};

interface MutateVars {
  payload: ObservationFormData;
  speciesData?: SpeciesDropdownItem | null;
  placeData?: PlaceDropdownItem | null;
}

export const useCreateObservation = () => {
  const queryClient = useQueryClient();
  const { profile } = useProfile();

  return useMutationWithTranslation<ObservationItem, AppError, MutateVars>({
    mutationFn: async ({ payload, speciesData, placeData }) => {
      if (isConnected()) {
        try {
          const res = await api.post(OBSERVATION_URL, payload);
          observationRepository.upsertFromServer(res.data);
          return res.data;
        } catch (e) {
          const err = e as AppError;
          if (!err.isNetworkError && !err.isTimeout) throw err;
        }
      }

      const item = observationRepository.createLocal(payload, { speciesData, placeData }, profile);
      runObservationSync(); // in case connectivity just flickered back
      return item;
    },
    onSettled: () => invalidateObservationCaches(queryClient),
  });
};

export const useUpdateObservation = (id: number | null | undefined) => {
  const queryClient = useQueryClient();
  const { profile } = useProfile();

  return useMutationWithTranslation<ObservationItem, AppError, MutateVars>({
    mutationFn: async ({ payload, speciesData, placeData }) => {
      if (id == null) throw new Error("Missing observation id");

      if (id > 0 && isConnected()) {
        try {
          const res = await api.patch(`${OBSERVATION_URL}${id}/`, payload);
          observationRepository.upsertFromServer(res.data);
          return res.data;
        } catch (e) {
          const err = e as AppError;
          if (!err.isNetworkError && !err.isTimeout) throw err;
        }
      }

      const currentItem =
        queryClient.getQueryData<ObservationItem>(["Observation", id]) ?? null;
      const item = observationRepository.updateLocal(
        id,
        payload,
        currentItem,
        { speciesData, placeData },
        profile,
      );
      if (id > 0) runObservationSync();
      return item;
    },
    onSettled: () => invalidateObservationCaches(queryClient),
  });
};

export const useDeleteObservation = () => {
  const queryClient = useQueryClient();

  return useMutationWithTranslation<void, AppError, number>({
    mutationFn: async (id: number) => {
      if (id > 0 && isConnected()) {
        try {
          await api.delete(`${OBSERVATION_URL}${id}/`);
          observationRepository.removeLocal(id);
          return;
        } catch (e) {
          const err = e as AppError;
          if (!err.isNetworkError && !err.isTimeout) throw err;
        }
      }

      observationRepository.deleteLocal(id);
      if (id > 0) runObservationSync();
    },
    onSettled: () => invalidateObservationCaches(queryClient),
  });
};
