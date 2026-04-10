import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { queryClient } from './queryClient';
import { AppRoutes } from './AppRoutes';
import { AuthProvider } from '../features/auth/AuthProvider';

export function App() {
  const basename =
    ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_ROUTER_BASENAME as string | undefined) || '/admin-ui';
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter basename={basename}>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
