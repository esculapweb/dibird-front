import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { BottomSheet } from "../services/bottomSheet";
import { useApiError } from "./useApiError";
import { isValidationError } from "./useMutationWithTranslation";

type DeleteCallbacks = {
  onSuccess: () => void;
  onError: (e: unknown) => void;
};

interface ConfirmDeleteParams {
  message: string;
  // Receives the callbacks for mutation.mutate(id, callbacks) — the caller
  // owns the mutation, this hook only owns the confirm sheet around it. A
  // caller that leaves the screen afterwards does so in its own onSuccess
  // before calling the one passed in.
  runDelete: (callbacks: DeleteCallbacks) => void;
  tag: string;
}

/**
 * The confirm sheet shown before every delete — detail screens and list rows.
 * The hook itself never navigates: a list row stays put and the list updates
 * through the delete mutation's own cache invalidation, while a detail screen
 * goes back from inside runDelete.
 */
export const useConfirmDelete = () => {
  const { t } = useTranslation();
  const { showErrorToast } = useApiError();

  return useCallback(
    ({ message, runDelete, tag }: ConfirmDeleteParams) => {
      BottomSheet.show({
        title: t("delete_title"),
        description: message,
        confirmText: t("delete"),
        cancelText: t("cancel"),
        danger: true,
        // Resolved rather than fired and forgotten: the promise keeps the
        // sheet's spinner up until the delete settles. It resolves on failure
        // too — the error is reported by the toast, and the sheet has nothing
        // left to wait for. The delete mutations go through
        // useMutationWithTranslation, which toasts everything but a
        // validation error; only that one is left to report here.
        onConfirm: () =>
          new Promise<void>((resolve) => {
            runDelete({
              onSuccess: resolve,
              onError: (e) => {
                if (isValidationError(e)) showErrorToast(e, tag);
                resolve();
              },
            });
          }),
      });
    },
    [t, showErrorToast],
  );
};
