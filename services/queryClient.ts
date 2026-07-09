import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";

import { AppError } from "../types";

export const queryClient = new QueryClient({
  queryCache: new QueryCache(),
  mutationCache: new MutationCache(),
  defaultOptions: {
    queries: {
      retry: (failureCount: number, error: Error) => {
        const appError = error as AppError;
        if (appError.code === "UNAUTHORIZED") return false;
        if (appError.isServerError) return false;
        return failureCount < 1;
      },
      staleTime: 10_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {},
  },
});
