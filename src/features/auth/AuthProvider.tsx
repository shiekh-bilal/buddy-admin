import React, { createContext, useContext, useMemo, useState } from 'react';
import { adminLogin } from '../../api/admin';
import { getStoredToken, setStoredToken } from './authStorage';

type AuthContextValue = {
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider(props: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());

  const value = useMemo<AuthContextValue>(() => {
    return {
      token,
      login: async (username: string, password: string) => {
        const { token: nextToken } = await adminLogin({ username, password });
        setStoredToken(nextToken);
        setToken(nextToken);
      },
      logout: () => {
        setStoredToken(null);
        setToken(null);
      }
    };
  }, [token]);

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

