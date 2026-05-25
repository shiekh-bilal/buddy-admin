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
  isBanned: boolean;
  bannedAt: string | null;
  banReason: string | null;
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

export function banAdminUser(userId: number, payload?: { reason?: string }): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/admin/users/${userId}/ban`, {
    method: 'POST',
    json: { reason: payload?.reason ?? null }
  });
}

export function unbanAdminUser(userId: number): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/admin/users/${userId}/unban`, { method: 'POST' });
}

export type AdminRoom = {
  id: number;
  key: string | null;
  sequence: number;
  name: string;
  icon: string | null;
  description: string | null;
  isOfficial: boolean;
  capacity: number;
  status: 'active' | 'expired' | 'deleted';
  expiresAt: string | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
};

export type AdminRoomsResponse = {
  items: AdminRoom[];
  total: number;
  page: number;
  pageSize: number;
};

export function getAdminRooms(params: { page: number; pageSize: number; q?: string; status?: string }): Promise<AdminRoomsResponse> {
  const search = new URLSearchParams();
  search.set('page', String(params.page));
  search.set('pageSize', String(params.pageSize));
  if (params.q) search.set('q', params.q);
  if (params.status) search.set('status', params.status);
  return apiRequest<AdminRoomsResponse>(`/api/admin/rooms?${search.toString()}`, { method: 'GET' });
}

export function deleteAdminRoom(roomId: number): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/admin/rooms/${roomId}`, { method: 'DELETE' });
}

export type AdminRoomMember = {
  id: number;
  roomId: number;
  userId: number;
  mutedUntil: string | null;
  user: Pick<AdminUser, 'id' | 'username' | 'email' | 'avatar' | 'status' | 'lastSeen' | 'campus' | 'dob' | 'isBanned' | 'bannedAt'> | null;
};

export type AdminRoomMembersResponse = {
  room: Omit<AdminRoom, 'memberCount'>;
  members: AdminRoomMember[];
};

export function getAdminRoomMembers(roomId: number): Promise<AdminRoomMembersResponse> {
  return apiRequest<AdminRoomMembersResponse>(`/api/admin/rooms/${roomId}/members`, { method: 'GET' });
}

export function removeAdminUserFromRoom(roomId: number, userId: number): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/admin/rooms/${roomId}/remove-user`, { method: 'POST', json: { userId } });
}

export type AdminReportUser = {
  id: number;
  username: string;
  email: string;
  avatar: string;
  campus: string | null;
  dob: string;
  isBanned: boolean;
  bannedAt: string | null;
};

export type AdminReport = {
  id: number;
  reporterId: number;
  reportedId: number;
  reason: string;
  attachmentUrl: string[] | string | null;
  attachments: string[];
  isBuddy: boolean;
  status: 'open' | 'reviewed' | 'dismissed' | 'actioned';
  reviewedAt: string | null;
  reviewedByAdminId: number | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
  reporter: AdminReportUser | null;
  reported: AdminReportUser | null;
};

export type AdminReportsResponse = {
  items: AdminReport[];
  total: number;
  page: number;
  pageSize: number;
};

export function getAdminReports(params: { page: number; pageSize: number; q?: string; status?: string }): Promise<AdminReportsResponse> {
  const search = new URLSearchParams();
  search.set('page', String(params.page));
  search.set('pageSize', String(params.pageSize));
  if (params.q) search.set('q', params.q);
  if (params.status) search.set('status', params.status);
  return apiRequest<AdminReportsResponse>(`/api/admin/reports?${search.toString()}`, { method: 'GET' });
}

export function updateAdminReport(reportId: number, payload: { status: AdminReport['status']; reviewNotes?: string }): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/admin/reports/${reportId}`, { method: 'PATCH', json: payload });
}
