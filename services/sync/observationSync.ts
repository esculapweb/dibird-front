import api from "../api";
import { queryClient } from "../queryClient";
import { AppError } from "../../types";
import * as observationRepository from "../../hooks/repositories/observationRepository";
import { ObservationMutationPayload } from "../../hooks/repositories/observationRepository";
import { isConnected } from "./networkStatus";

const OBSERVATION_URL = "/myapi/observation2/";

const invalidateObservationQueries = (id?: number | null) => {
  // refetchType: "all" (not the default "active") matters here: this sync runs
  // in the background on reconnect regardless of which screen is mounted, and
  // useList's infinite query has refetchOnMount disabled — so a query that's
  // merely marked stale while unmounted would otherwise keep showing whatever
  // (possibly wrong/incomplete) data it last had the next time it's opened.
  queryClient.invalidateQueries({
    queryKey: ["Observations"],
    exact: false,
    refetchType: "all",
  });
  if (id != null) {
    queryClient.invalidateQueries({
      queryKey: ["Observation", id],
      exact: false,
      refetchType: "all",
    });
  }
};

// Drains the local mutation queue for entity "observation". Unlike profileSync
// (a singleton row), several independent offline-created/edited/deleted
// observations can be queued at once, so a real (non-network) error on one
// mutation only fails that mutation and moves on to the next — it must not
// block the rest of the batch.
export const runObservationSync = async () => {
  if (!isConnected()) return;

  for (const mutation of observationRepository.getPendingMutations()) {
    const payload = mutation.payload as ObservationMutationPayload;

    try {
      if (payload.op === "create") {
        const res = await api.post(OBSERVATION_URL, payload.data);
        observationRepository.replaceLocalWithServer(payload.localId, res.data);
        observationRepository.resolveMutation(mutation.id);
        invalidateObservationQueries(payload.localId);
        invalidateObservationQueries(res.data.id);
      } else if (payload.op === "update") {
        const res = await api.patch(`${OBSERVATION_URL}${payload.localId}/`, payload.data);
        observationRepository.upsertFromServer(res.data);
        observationRepository.resolveMutation(mutation.id);
        invalidateObservationQueries(payload.localId);
      } else {
        await api.delete(`${OBSERVATION_URL}${payload.localId}/`);
        observationRepository.removeLocal(payload.localId);
        observationRepository.resolveMutation(mutation.id);
        invalidateObservationQueries(payload.localId);
      }
    } catch (e) {
      const error = e as AppError;
      if (error.isNetworkError || error.isTimeout) return;
      observationRepository.failMutation(mutation.id, payload.localId, error.message);
      invalidateObservationQueries(payload.localId);
    }
  }
};
