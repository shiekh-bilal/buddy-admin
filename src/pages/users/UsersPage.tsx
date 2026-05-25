import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { banAdminUser, getAdminUsers, unbanAdminUser } from '../../api/admin';
import { HttpError } from '../../api/http';
import { useAuth } from '../../features/auth/AuthProvider';
import { connectAdminSocket } from '../../realtime/adminSocket';

function formatDate(d: string | null): string {
  if (!d) return '-';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleString();
}

export function UsersPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const queryKey = useMemo(() => ['adminUsers', { page, pageSize, q: q.trim() || undefined }], [page, pageSize, q]);
  const query = useQuery({
    queryKey,
    queryFn: () => getAdminUsers({ page, pageSize, q: q.trim() || undefined }),
    staleTime: 15_000
  });

  useEffect(() => {
    if (query.error instanceof HttpError && query.error.status === 401) {
      logout();
      navigate('/login', { replace: true });
    }
  }, [logout, navigate, query.error]);

  useEffect(() => {
    const socket = connectAdminSocket();
    const onUsersUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    };
    socket.on('admin:users:updated', onUsersUpdated);
    return () => {
      socket.off('admin:users:updated', onUsersUpdated);
      socket.disconnect();
    };
  }, [queryClient]);

  const banMutation = useMutation({
    mutationFn: (payload: { userId: number; reason?: string }) => banAdminUser(payload.userId, { reason: payload.reason }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    }
  });

  const unbanMutation = useMutation({
    mutationFn: (userId: number) => unbanAdminUser(userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    }
  });

  const totalPages = query.data ? Math.max(1, Math.ceil(query.data.total / query.data.pageSize)) : 1;

  return (
    <div className="container">
      <div className="card">
        <div className="cardHeader">
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Users</div>
            <div className="muted" style={{ fontSize: 13 }}>
              Browse all registered users
            </div>
          </div>
          <div className="row">
            <Link className="button" to="/dashboard">
              Dashboard
            </Link>
            <Link className="button" to="/rooms">
              Rooms
            </Link>
            <Link className="button" to="/reports">
              Reports
            </Link>
          </div>
        </div>
        <div className="cardBody" style={{ display: 'grid', gap: 12 }}>
          <div className="row">
            <input
              className="input"
              placeholder="Search by username or email…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
            <button
              className="button"
              type="button"
              onClick={() => {
                query.refetch();
              }}
              disabled={query.isFetching}
            >
              {query.isFetching ? 'Searching…' : 'Search'}
            </button>
          </div>

          {query.isLoading ? <div className="muted">Loading…</div> : null}
          {query.isError ? <div className="error">{query.error instanceof Error ? query.error.message : 'Failed to load users'}</div> : null}

          {query.data ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left' }}>
                    <th style={{ padding: '10px 8px' }}>ID</th>
                    <th style={{ padding: '10px 8px' }}>Username</th>
                    <th style={{ padding: '10px 8px' }}>Email</th>
                    {/* <th style={{ padding: '10px 8px' }}>Status</th>
                    <th style={{ padding: '10px 8px' }}>Last Seen</th> */}
                    <th style={{ padding: '10px 8px' }}>Campus</th>
                    <th style={{ padding: '10px 8px' }}>Banned</th>
                    {/* <th style={{ padding: '10px 8px' }}>Created</th> */}
                    <th style={{ padding: '10px 8px' }} />
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((u) => (
                    <tr key={u.id} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <td style={{ padding: '10px 8px' }}>{u.id}</td>
                      <td style={{ padding: '10px 8px' }}>{u.username}</td>
                      <td style={{ padding: '10px 8px' }}>{u.email}</td>
                      {/* <td style={{ padding: '10px 8px' }}>{u.status}</td>
                      <td style={{ padding: '10px 8px' }}>{formatDate(u.lastSeen)}</td> */}
                      <td style={{ padding: '10px 8px' }}>{u.campus || '-'}</td>
                      <td style={{ padding: '10px 8px' }}>
                        {u.isBanned ? (
                          <span title={u.banReason || ''}>Yes{u.bannedAt ? ` (${formatDate(u.bannedAt)})` : ''}</span>
                        ) : (
                          <span className="muted">No</span>
                        )}
                      </td>
                      {/* <td style={{ padding: '10px 8px' }}>{formatDate(u.createdAt)}</td> */}
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                        {u.isBanned ? (
                          <button
                            className="button"
                            type="button"
                            onClick={() => unbanMutation.mutate(u.id)}
                            disabled={unbanMutation.isPending}
                          >
                            {unbanMutation.isPending ? 'Unbanning…' : 'Unban'}
                          </button>
                        ) : (
                          <button
                            className="button buttonPrimary"
                            type="button"
                            onClick={() => {
                              const reason = window.prompt(`Ban user ${u.id}. Optional reason:`) ?? '';
                              if (!window.confirm(`Ban user ${u.id} (${u.username})?`)) return;
                              banMutation.mutate({ userId: u.id, reason: reason.trim() || undefined });
                            }}
                            disabled={banMutation.isPending}
                          >
                            {banMutation.isPending ? 'Banning…' : 'Ban'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {query.data ? (
            <div className="row">
              <div className="muted" style={{ fontSize: 12 }}>
                {query.data.total} users
              </div>
              <div className="spacer" />
              <button className="button" type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                Prev
              </button>
              <div className="muted" style={{ fontSize: 12 }}>
                Page {page} / {totalPages}
              </div>
              <button
                className="button"
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
