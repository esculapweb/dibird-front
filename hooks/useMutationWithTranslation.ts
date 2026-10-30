import {
  useMutation,
  MutationOptions,
} from "@tanstack/react-query";
import { useApiError } from "./useApiError";
import { AppError } from "../types";

// A 400 carrying a field map is left to the caller: a form puts it on its
// fields. A caller with no form checks this in its own onError and toasts only
// then — everything else the wrapper below has already shown, and showing it
// again from the caller only doubled the toast and the log line.
export const isValidationError = (error: unknown): boolean => {
  const appError = error as AppError;
  return (
    appError?.status === 400 &&
    !!appError?.response?.data &&
    typeof appError.response.data === "object"
  );
};

export const useMutationWithTranslation = <
  TData = unknown,
  TError extends AppError = AppError,
  TVariables = unknown,
  TContext = unknown,
>(
  options: MutationOptions<TData, TError, TVariables, TContext> & {
    showErrorToast?: boolean;
  },
) => {
  const { showErrorToast } = useApiError();

  return useMutation({
    ...options,
    onError: (error, variables, onMutateResult, context) => {
      const appError = error as AppError;

      if (!isValidationError(appError) && options.showErrorToast !== false) {
        showErrorToast(appError);
      }

      options.onError?.(error, variables, onMutateResult, context);
    },
  });
};
