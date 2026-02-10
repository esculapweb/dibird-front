import { useMutation } from '@tanstack/react-query';
import { useApiError } from './useApiError';

export const useMutationWithTranslation = (options) => {
  const { getTranslatedError, showErrorToast } = useApiError();

  return useMutation({
    ...options,
    onError: (error, variables, context) => {
      // console.error('Mutation error:', {
      //   mutationKey: options.mutationKey,
      //   error: getTranslatedError(error),
      //   variables,
      // });

      if (options.showErrorToast !== false) {
        showErrorToast(error);
      }

      if (options.onError) {
        options.onError(error, variables, context);
      }
    },
  });
};