import { useQuery } from '@tanstack/react-query';
import { useApiError } from './useApiError';

export const useQueryWithTranslation = (options) => {
  const { getTranslatedError, showErrorToast } = useApiError();

  return useQuery({
    ...options,
    onError: (error, ...args) => {
      console.error('Query error:', {
        queryKey: options.queryKey,
        error: getTranslatedError(error),
      });

      if (options.showErrorToast !== false) {
        showErrorToast(error);
      }

      if (options.onError) {
        options.onError(error, ...args);
      }
    },
  });
};