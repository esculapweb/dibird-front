import { useMutation } from "@tanstack/react-query";
import { useApiError } from "./useApiError";

export const useMutationWithTranslation = (options) => {
  const { showErrorToast } = useApiError();

  return useMutation({
    ...options,
    onError: (error, variables, context) => {
      const isValidationError =
        error?.status === 400 &&
        error?.response?.data &&
        typeof error.response.data === "object";

      if (!isValidationError && options.showErrorToast !== false) {
        showErrorToast(error);
      }

      options.onError?.(error, variables, context);
    },
  });
};
