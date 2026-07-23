import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import api from "../../services/api";
import { useApiError } from "../useApiError";
import { useMutationWithTranslation } from "../useMutationWithTranslation";
import { useProfile } from "../../store/profile-context";
import { useLanguage } from "../../store/language-context";
import { isConnected } from "../../services/sync/networkStatus";
import { runObservationSync } from "../../services/sync/observationSync";
import * as observationRepository from "../repositories/observationRepository";
import * as diaryRepository from "../repositories/diaryRepository";
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
// ObservationDetailScreen and ObservationEditorScreen. Diary has its own
// equivalent (hooks/Diary/useOfflineDiary.ts); Place/Community still use the
// generic (online-only) hooks unchanged.

const invalidateObservationCaches = (queryClient: ReturnType<typeof useQueryClient>) => {
  // ["Observation"] (no id) is included here with exact:false, which prefix-matches
  // ["Observation", anyId] too, so a single shared list covers add/update/delete.
  // refetchType: "all" so this also refreshes the Observations list even if it
  // happens to be unmounted (useList has refetchOnMount disabled).
  INVALIDATION_MAP.Observation.update.forEach((key) =>
    queryClient.invalidateQueries({ queryKey: key, exact: false, refetchType: "all" }),
  );
};

// An observation created/edited inside a diary that itself hasn't synced yet
// (temp negative id) must never send that temp id to the server — it means
// nothing outside this device. Resolves it through diaryRepository (same
// alias-row mechanism observations use for their own temp ids): already a
// real id or null → unchanged; parent diary discarded before it ever synced →
// cleared to null; parent diary just not synced *yet* → left as the same
// negative id (still meaningless to the server) but flagged via
// `diaryStillPending` so the caller skips the online attempt entirely instead
// of POSTing/PATCHing a payload with a temp id in it.
const resolveObservationDiary = (payload: ObservationFormData) => {
  if (payload.diary == null)
    return {
      payload,
      diaryStillPending: false,
      diaryTerritory: null,
      diaryPlace: null,
      diaryPlaceData: null,
      diaryDateTime: null,
      diaryPrivate: null,
    };
  const resolved = diaryRepository.resolveDiaryId(payload.diary);
  const diaryStillPending = resolved != null && resolved < 0;
  // A diary-scoped form never carries its own territory, place, date_time or
  // private (see ObservationEditorScreen's buildObservationPayload) — the
  // offline synthesis in observationRepository needs them explicitly (as
  // SynthesizeExtras.diaryTerritory/diaryPlace/diaryPlaceData/diaryDateTime/
  // diaryPrivate) or they default to blank/now/false, which then wins over
  // any better fallback everywhere this observation is later read back.
  // `resolved` (not the original temp id) works here whether the diary has
  // synced yet or not: getDiary resolves both the temp id and, once
  // replaceLocalWithServer has run, the real id.
  const diary = resolved != null ? diaryRepository.getDiary(resolved) : null;
  const diaryTerritory = diary?.territory ?? null;
  const diaryPlace = diary?.place ?? null;
  const diaryPlaceData = diary?.place_data ?? null;
  const diaryDateTime = diary?.date_time ?? null;
  const diaryPrivate = diary?.private ?? null;
  return {
    payload: { ...payload, diary: resolved === undefined ? null : resolved },
    diaryStillPending,
    diaryTerritory,
    diaryPlace,
    diaryPlaceData,
    diaryDateTime,
    diaryPrivate,
  };
};

export const useObservationItem = (
  id: number | null | undefined,
  // Item already known from wherever navigation originated (a list card, a
  // just-completed create/update mutation, ...). Seeds the query cache so the
  // screen renders immediately instead of spinning, and — the part that
  // actually matters offline — gives the query cache "existing" data to fall
  // back to if the detail fetch below fails, the same way an already-cached
  // query would. Without this, the very first fetch of a given observation id
  // has nothing to fall back to and the offline error surfaces even though
  // the item is right there on the list screen the user tapped it from.
  initialItem?: ObservationItem | null,
) => {
  const { showErrorToast } = useApiError();
  const { profile } = useProfile();
  const { language } = useLanguage();

  // The list endpoint's `is_owner` has been observed to disagree with the
  // detail endpoint's for the same observation. Online this is invisible —
  // the real detail fetch below lands almost immediately and overwrites it —
  // but offline we can be stuck showing this seed indefinitely, so don't
  // trust the list's is_owner verbatim: recompute it from owner id vs the
  // (offline-cached) current profile, which both endpoints should agree on.
  const seededInitialItem = useMemo(() => {
    if (!initialItem || initialItem.id !== id) return undefined;
    if (!profile?.user || !initialItem.owner) return initialItem;
    return { ...initialItem, is_owner: initialItem.owner.id === profile.user };
  }, [initialItem, id, profile?.user]);

  const query = useQuery({
    // `language` is part of the key because species_data (name_lang, segment)
    // and territory_data.name come back localized by the request's
    // Accept-Language — without it, switching language reads back the stale
    // previous-language copy (staleTime is a day), leaving the detail screen
    // showing the old name and, worse, an old-language `segment` that the
    // "about species" tap can't resolve. See ObservationDetailScreen /
    // CommunityDetailScreen (which have the same fix in useItem).
    queryKey: ["Observation", id, language],
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
    ...(seededInitialItem
      ? { initialData: seededInitialItem, initialDataUpdatedAt: 0 }
      : {}),
  });

  useEffect(() => {
    // TanStack sets isError on *any* failed fetch, background ones included,
    // and does not clear `data` when that happens — so isError alone doesn't
    // mean "nothing to show". Only toast when there's truly no data (from
    // cache or the initialData seeded above); the screen's own ErrorOverlay
    // gate uses the same `isError && !data` condition.
    if (query.isError && !query.data) {
      showErrorToast(query.error, "useObservationItem");
    }
  }, [query.isError, query.error, query.data]);

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
      // Identifies this logical create attempt across every retry of it (the
      // live attempt below and any later queued retry both send the same
      // value as client_request_id) so a backend that recognizes a repeat can
      // return the already-created row instead of making another one — see
      // requeuePendingMutation's call site in observationSync.ts for the retry
      // side. Without matching backend support this field is currently inert.
      const clientRequestId = observationRepository.makeClientRequestId();
      const {
        payload: resolvedPayload,
        diaryStillPending,
        diaryTerritory,
        diaryPlace,
        diaryPlaceData,
        diaryDateTime,
        diaryPrivate,
      } = resolveObservationDiary(payload);

      if (isConnected() && !diaryStillPending) {
        try {
          const res = await api.post(OBSERVATION_URL, {
            ...resolvedPayload,
            client_request_id: clientRequestId,
          });
          observationRepository.upsertFromServer(res.data);
          return res.data;
        } catch (e) {
          const err = e as AppError;
          // On React Native, normalizeApiError (services/errors.ts) classifies
          // almost every no-response failure as isTimeout rather than
          // isNetworkError — RN's networking layer reports connection-refused
          // the same generic "Network Error" way it reports a real timeout, and
          // a timeout value is always configured, so the isNetworkError branch
          // there is effectively unreachable in practice. Requiring it here
          // meant a genuinely-down backend (e.g. a paused local dev container,
          // which freezes the process and can't have committed anything) also
          // got treated as ambiguous and rethrown instead of queued — which
          // then crashed downstream (see ObservationEditorScreen's
          // extractApiError, fixed separately for a response-less error).
          if (!err.isNetworkError && !err.isTimeout) throw err;
        }
      }

      const item = observationRepository.createLocal(
        resolvedPayload,
        { speciesData, placeData, diaryTerritory, diaryPlace, diaryPlaceData, diaryDateTime, diaryPrivate },
        profile,
        clientRequestId,
      );
      runObservationSync(); // in case connectivity just flickered back
      return item;
    },
    onSettled: () => invalidateObservationCaches(queryClient),
  });
};

export const useUpdateObservation = (id: number | null | undefined) => {
  const queryClient = useQueryClient();
  const { profile } = useProfile();
  const { language } = useLanguage();

  return useMutationWithTranslation<ObservationItem, AppError, MutateVars>({
    mutationFn: async ({ payload, speciesData, placeData }) => {
      if (id == null) throw new Error("Missing observation id");
      const {
        payload: resolvedPayload,
        diaryStillPending,
        diaryTerritory,
        diaryPlace,
        diaryPlaceData,
        diaryDateTime,
        diaryPrivate,
      } = resolveObservationDiary(payload);

      if (id > 0 && isConnected() && !diaryStillPending) {
        try {
          const res = await api.patch(`${OBSERVATION_URL}${id}/`, resolvedPayload);
          observationRepository.upsertFromServer(res.data);
          return res.data;
        } catch (e) {
          const err = e as AppError;
          if (!err.isNetworkError && !err.isTimeout) throw err;
        }
      }

      const currentItem =
        queryClient.getQueryData<ObservationItem>(["Observation", id, language]) ??
        null;
      const item = observationRepository.updateLocal(
        id,
        resolvedPayload,
        currentItem,
        { speciesData, placeData, diaryTerritory, diaryPlace, diaryPlaceData, diaryDateTime, diaryPrivate },
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
