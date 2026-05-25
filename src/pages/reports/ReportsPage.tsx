import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { banAdminUser, getAdminReports, updateAdminReport } from '../../api/admin';
import { HttpError } from '../../api/http';
import { useAuth } from '../../features/auth/AuthProvider';
import { connectAdminSocket } from '../../realtime/adminSocket';

function formatDate(d: string | null): string {
  if (!d) return '-';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleString();
}

export function ReportsPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('open');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const reportsQueryKey = useMemo(
    () => ['adminReports', { page, pageSize, q: q.trim() || undefined, status: status.trim() || undefined }],
    [page, pageSize, q, status]
  );
  const reportsQuery = useQuery({
    queryKey: reportsQueryKey,
    queryFn: () => getAdminReports({ page, pageSize, q: q.trim() || undefined, status: status.trim() || undefined }),
    staleTime: 10_000
  });

  useEffect(() => {
    if (reportsQuery.error instanceof HttpError && reportsQuery.error.status === 401) {
      logout();
      navigate('/login', { replace: true });
    }
  }, [logout, navigate, reportsQuery.error]);

  useEffect(() => {
    const socket = connectAdminSocket();
    const onCreated = () => {
      queryClient.invalidateQueries({ queryKey: ['adminReports'] });
    };
    const onUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ['adminReports'] });
    };
    socket.on('admin:reports:created', onCreated);
    socket.on('admin:reports:updated', onUpdated);
    return () => {
      socket.off('admin:reports:created', onCreated);
      socket.off('admin:reports:updated', onUpdated);
      socket.disconnect();
    };
  }, [queryClient]);

  const updateMutation = useMutation({
    mutationFn: (payload: { reportId: number; status: 'open' | 'reviewed' | 'dismissed' | 'actioned'; reviewNotes?: string }) =>
      updateAdminReport(payload.reportId, { status: payload.status, reviewNotes: payload.reviewNotes }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['adminReports'] });
    }
  });

  const banMutation = useMutation({
    mutationFn: (payload: { userId: number; reason?: string }) => banAdminUser(payload.userId, { reason: payload.reason }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['adminReports'] });
      await queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    }
  });

  const totalPages = reportsQuery.data ? Math.max(1, Math.ceil(reportsQuery.data.total / reportsQuery.data.pageSize)) : 1;

  return (
    <div className="container">
      <div className="card">
        <div className="cardHeader">
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Reports</div>
            <div className="muted" style={{ fontSize: 13 }}>
              Review user reports and take action
            </div>
          </div>
          <div className="row">
            <Link className="button" to="/dashboard">
              Dashboard
            </Link>
            <Link className="button" to="/rooms">
              Rooms
            </Link>
            <Link className="button" to="/users">
              Users
            </Link>
          </div>
        </div>
        <div className="cardBody" style={{ display: 'grid', gap: 12 }}>
          <div className="row">
            <input
              className="input"
              placeholder="Search by reporter/reported username or email…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
            <select
              className="input"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              style={{ width: 180 }}
            >
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="reviewed">Reviewed</option>
              <option value="dismissed">Dismissed</option>
              <option value="actioned">Actioned</option>
            </select>
            <button
              className="button"
              type="button"
              onClick={() => {
                reportsQuery.refetch();
              }}
              disabled={reportsQuery.isFetching}
            >
              {reportsQuery.isFetching ? 'Searching…' : 'Search'}
            </button>
          </div>

          {reportsQuery.isLoading ? <div className="muted">Loading…</div> : null}
          {reportsQuery.isError ? (
            <div className="error">{reportsQuery.error instanceof Error ? reportsQuery.error.message : 'Failed to load reports'}</div>
          ) : null}

          {reportsQuery.data ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left' }}>
                    <th style={{ padding: '10px 8px' }}>ID</th>
                    <th style={{ padding: '10px 8px' }}>Reporter</th>
                    <th style={{ padding: '10px 8px' }}>Reported</th>
                    <th style={{ padding: '10px 8px' }}>Reason</th>
                    <th style={{ padding: '10px 8px' }}>Attachments</th>
                    <th style={{ padding: '10px 8px' }}>Status</th>
                    <th style={{ padding: '10px 8px' }}>Created</th>
                    <th style={{ padding: '10px 8px' }} />
                  </tr>
                </thead>
                <tbody>
                  {reportsQuery.data.items.map((r) => (
                    <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <td style={{ padding: '10px 8px' }}>{r.id}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ fontWeight: 700 }}>{r.reporter?.username ?? `User ${r.reporterId}`}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {r.reporter?.email ?? '-'}
                        </div>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ fontWeight: 700 }}>{r.reported?.username ?? `User ${r.reportedId}`}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {r.reported?.email ?? '-'}
                        </div>
                        {r.reported?.isBanned ? (
                          <div className="muted" style={{ fontSize: 12 }}>
                            Banned {r.reported.bannedAt ? `(${formatDate(r.reported.bannedAt)})` : ''}
                          </div>
                        ) : null}
                      </td>
                      <td style={{ padding: '10px 8px', maxWidth: 360 }}>
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.reason}</div>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        {r.attachments.length > 0 ? (
                          <a href={r.attachments[0]} target="_blank" rel="noreferrer">
                            {r.attachments.length} file{r.attachments.length === 1 ? '' : 's'}
                          </a>
                        ) : (
                          <span className="muted">-</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 8px' }}>{r.status}</td>
                      <td style={{ padding: '10px 8px' }}>{formatDate(r.createdAt)}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                        <div className="row" style={{ justifyContent: 'flex-end' }}>
                          <button
                            className="button"
                            type="button"
                            onClick={() => updateMutation.mutate({ reportId: r.id, status: 'reviewed' })}
                            disabled={updateMutation.isPending || r.status === 'reviewed'}
                          >
                            Reviewed
                          </button>
                          <button
                            className="button"
                            type="button"
                            onClick={() => updateMutation.mutate({ reportId: r.id, status: 'dismissed' })}
                            disabled={updateMutation.isPending || r.status === 'dismissed'}
                          >
                            Dismiss
                          </button>
                          <button
                            className="button buttonPrimary"
                            type="button"
                            onClick={() => {
                              const reason = window.prompt(`Ban reported user ${r.reportedId}. Optional reason:`, r.reason) ?? '';
                              if (!window.confirm(`Ban user ${r.reportedId}?`)) return;
                              banMutation.mutate({ userId: r.reportedId, reason: reason.trim() || undefined });
                              updateMutation.mutate({ reportId: r.id, status: 'actioned' });
                            }}
                            disabled={banMutation.isPending || updateMutation.isPending || r.reported?.isBanned === true}
                          >
                            {r.reported?.isBanned ? 'Banned' : banMutation.isPending ? 'Banning…' : 'Ban User'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {reportsQuery.data ? (
            <div className="row">
              <div className="muted" style={{ fontSize: 12 }}>
                {reportsQuery.data.total} reports
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
