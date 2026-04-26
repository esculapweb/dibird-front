import {
  useMutation,
  MutationOptions,
  DefaultError,
} from "@tanstack/react-query";
import { useApiError } from "./useApiError";
import { AppError } from "../types";

export const useMutationWithTranslation = (
  options: MutationOptions<unknown, DefaultError, unknown, unknown> & {
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
