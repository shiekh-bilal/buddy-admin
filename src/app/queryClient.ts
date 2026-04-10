import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount: number, error: unknown) => {
        if (typeof error === 'object' && error && 'status' in error && (error as { status?: number }).status === 401) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false
    }
  }
});
