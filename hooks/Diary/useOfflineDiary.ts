import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import api from "../../services/api";
import { useApiError } from "../useApiError";
import { useMutationWithTranslation } from "../useMutationWithTranslation";
import { useProfile } from "../../store/profile-context";
import { isConnected } from "../../services/sync/networkStatus";
import { runDiarySync } from "../../services/sync/diarySync";
import * as diaryRepository from "../repositories/diaryRepository";
import { ownerFromProfile } from "../repositories/shared";
import { INVALIDATION_MAP } from "../../util/invalidationMap";
import {
  AppError,
  DiaryFormData,
  DiaryItem,
  DiaryListItem,
  PlaceDropdownItem,
} from "../../types";

const DIARY_URL = "/myapi/diary2/";

// Diary-specific replacements for hooks/useItem.ts's generic useItem /
// useCreateItem / useUpdateItem / useDeleteItem — mirrors
// hooks/Observation/useOfflineObservation.ts. Place/Community keep using the
// generic (online-only) hooks unchanged.

const invalidateDiaryCaches = (queryClient: ReturnType<typeof useQueryClient>) => {
  INVALIDATION_MAP.Diary.update.forEach((key) =>
    queryClient.invalidateQueries({ queryKey: key, exact: false, refetchType: "all" }),
  );
};

export const useDiaryItem = (
  id: number | null | undefined,
  // A diary card in the list only has DiaryListItem's fields (no
  // owner/is_owner/created_at/user_data — those are detail-only). We can still
  // seed the query cache with a best-effort detail shape: is_owner is
  // recomputed from `profile` id vs the current profile (both endpoints agree
  // on that), and the owner/user_data display fields fall back to the current
  // profile's own info when it *is* the current user's diary, else a blank
  // placeholder — corrected the moment the real fetch (or offline cache) lands.
  // This mirrors useObservationItem's initialData seeding — see its comment
  // for why this matters offline (nothing to fall back to on the very first
  // fetch of a given id otherwise).
  initialItem?: DiaryListItem | null,
) => {
  const { showErrorToast } = useApiError();
  const { profile } = useProfile();

  const seededInitialItem = useMemo(() => {
    if (!initialItem || initialItem.id !== id) return undefined;
    const isOwner = !!profile?.user && initialItem.profile === profile.user;
    const owner = ownerFromProfile(isOwner ? profile : null);
    const seeded = {
      ...initialItem,
      is_owner: isOwner,
      owner,
      user_data: {
        avatar: owner.avatar,
        first_name: owner.first_name,
        id: owner.id,
        last_name: owner.last_name,
        timezone_id: owner.timezone_id,
        username: owner.username,
      },
      created_at: initialItem.date_time,
      updated_at: initialItem.date_time,
    };
    // Persist this snapshot (in particular observation_count) so this diary
    // has a locally-known baseline the moment its detail screen is opened —
    // not just for this one render's route params. Runs synchronously here
    // (render phase, not an effect) specifically so it's guaranteed to land
    // before the sibling observations ListScreen's own query fires (that one
    // only starts from an effect, which can't run until after this whole
    // render commits) — see fetchDiaryObservations's deriveFallback, which
    // reads it back via diaryRepository.getDiary to tell "genuinely zero
    // observations" apart from "never cached".
    diaryRepository.cacheKnownSnapshot(seeded);
    return seeded;
  }, [initialItem, id, profile?.user]);

  const query = useQuery({
    queryKey: ["Diary", id],
    // Deliberately untyped (matches the generic useItem this replaces).
    queryFn: async () => {
      if (id! < 0) {
        const local = diaryRepository.getDiary(id!);
        if (!local) throw new Error("Diary not found locally");
        return local;
      }

      try {
        const res = await api.get(`${DIARY_URL}${id}/`);
        diaryRepository.upsertFromServer(res.data);
        return res.data;
      } catch (e) {
        const local = diaryRepository.getDiary(id!);
        if (local) return local;
        throw e;
      }
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    ...(seededInitialItem ? { initialData: seededInitialItem, initialDataUpdatedAt: 0 } : {}),
  });

  useEffect(() => {
    if (query.isError && !query.data) {
      showErrorToast(query.error, "useDiaryItem");
    }
  }, [query.isError, query.error, query.data]);

  return query;
};

interface MutateVars {
  payload: DiaryFormData;
  placeData?: PlaceDropdownItem | null;
}

export const useCreateDiary = () => {
  const queryClient = useQueryClient();
  const { profile } = useProfile();

  return useMutationWithTranslation<DiaryItem, AppError, MutateVars>({
    mutationFn: async ({ payload, placeData }) => {
      const clientRequestId = diaryRepository.makeClientRequestId();

      if (isConnected()) {
        try {
          const res = await api.post(DIARY_URL, {
            ...payload,
            client_request_id: clientRequestId,
          });
          diaryRepository.upsertFromServer(res.data);
          return res.data;
        } catch (e) {
          const err = e as AppError;
          if (!err.isNetworkError && !err.isTimeout) throw err;
        }
      }

      const item = diaryRepository.createLocal(payload, { placeData }, profile, clientRequestId);
      runDiarySync();
      return item;
    },
    onSettled: () => invalidateDiaryCaches(queryClient),
  });
};

export const useUpdateDiary = (id: number | null | undefined) => {
  const queryClient = useQueryClient();
  const { profile } = useProfile();

  return useMutationWithTranslation<DiaryItem, AppError, MutateVars>({
    mutationFn: async ({ payload, placeData }) => {
      if (id == null) throw new Error("Missing diary id");

      if (id > 0 && isConnected()) {
        try {
          const res = await api.patch(`${DIARY_URL}${id}/`, payload);
          diaryRepository.upsertFromServer(res.data);
          return res.data;
        } catch (e) {
          const err = e as AppError;
          if (!err.isNetworkError && !err.isTimeout) throw err;
        }
      }

      const currentItem =
        queryClient.getQueryData<diaryRepository.DiaryRecord>(["Diary", id]) ?? null;
      const item = diaryRepository.updateLocal(id, payload, currentItem, { placeData }, profile);
      if (id > 0) runDiarySync();
      return item;
    },
    onSettled: () => invalidateDiaryCaches(queryClient),
  });
};

export const useDeleteDiary = () => {
  const queryClient = useQueryClient();

  return useMutationWithTranslation<void, AppError, number>({
    mutationFn: async (id: number) => {
      if (id > 0 && isConnected()) {
        try {
          await api.delete(`${DIARY_URL}${id}/`);
          diaryRepository.removeLocal(id);
          return;
        } catch (e) {
          const err = e as AppError;
          if (!err.isNetworkError && !err.isTimeout) throw err;
        }
      }

      diaryRepository.deleteLocal(id);
      if (id > 0) runDiarySync();
    },
    onSettled: () => invalidateDiaryCaches(queryClient),
  });
};
