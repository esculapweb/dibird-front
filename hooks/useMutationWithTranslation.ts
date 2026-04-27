import {
  useMutation,
  MutationOptions,
} from "@tanstack/react-query";
import { useApiError } from "./useApiError";
import { AppError } from "../types";

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
      const isValidationError =
        appError?.status === 400 &&
        appError?.response?.data &&
        typeof appError.response.data === "object";

      if (!isValidationError && options.showErrorToast !== false) {
        showErrorToast(appError);
      }

      options.onError?.(error, variables, onMutateResult, context);
    },
  });
};
