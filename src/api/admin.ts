import { apiRequest } from './http';

export type AdminLoginRequest = { username: string; password: string };
export type AdminLoginResponse = { token: string; admin: { id: number; username: string } };

export function adminLogin(payload: AdminLoginRequest): Promise<AdminLoginResponse> {
  return apiRequest<AdminLoginResponse>('/api/admin/login', { method: 'POST', json: payload });
}

export type AdminStats = {
  totalUsers: number;
  dau: number;
  messagesSent: number;
  awayMessagesSent: number;
  dauStart: string;
  asOf: string;
  timeZone: string;
};

export function getAdminStats(): Promise<AdminStats> {
  return apiRequest<AdminStats>('/api/admin/stats', { method: 'GET' });
}

export type AdminUser = {
  id: number;
  username: string;
  email: string;
  status: 'online' | 'offline' | 'away';
  lastSeen: string | null;
  avatar: string;
  age: number | null;
  dob: string;
  campus: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminUsersResponse = {
  items: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
};

export function getAdminUsers(params: { page: number; pageSize: number; q?: string }): Promise<AdminUsersResponse> {
  const search = new URLSearchParams();
  search.set('page', String(params.page));
  search.set('pageSize', String(params.pageSize));
  if (params.q) search.set('q', params.q);
  return apiRequest<AdminUsersResponse>(`/api/admin/users?${search.toString()}`, { method: 'GET' });
}
