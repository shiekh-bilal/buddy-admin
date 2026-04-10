import { io, type Socket } from 'socket.io-client';
import { getStoredToken } from '../features/auth/authStorage';

type AdminStats = {
  totalUsers: number;
  dau: number;
  messagesSent: number;
  awayMessagesSent: number;
  dauStart: string;
  asOf: string;
  timeZone: string;
};

function getSocketUrl(): string {
  const env = (import.meta as unknown as { env?: Record<string, string> }).env;
  const configured = env?.VITE_SOCKET_URL;
  if (typeof configured === 'string' && configured.trim()) return configured.replace(/\/+$/, '');
  const apiBase = env?.VITE_API_BASE_URL;
  if (typeof apiBase === 'string' && apiBase.trim()) return apiBase.replace(/\/+$/, '');
  return window.location.origin;
}

export function connectAdminSocket(): Socket {
  const token = getStoredToken();
  return io(getSocketUrl(), {
    transports: ['websocket'],
    auth: {
      adminToken: token ?? undefined
    }
  });
}

export type { AdminStats };

