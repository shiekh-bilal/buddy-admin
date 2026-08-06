import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { getAdminFeedback } from '../../api/admin';
import { HttpError } from '../../api/http';
import { useAuth } from '../../features/auth/AuthProvider';
import { connectAdminSocket } from '../../realtime/adminSocket';

function formatDate(d: string | null): string {
  if (!d) return '-';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleString();
}

function Rating(props: { value: number }) {
  const value = Math.max(1, Math.min(5, Math.round(props.value)));
  return (
    <span title={`${value} / 5`} style={{ letterSpacing: 1, color: '#f5b50a' }}>
      {'★'.repeat(value)}
      <span style={{ color: 'rgba(255,255,255,0.25)' }}>{'★'.repeat(5 - value)}</span>
    </span>
  );
}

export function FeedbackPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const limit = 25;
  const [offset, setOffset] = useState(0);

  const queryKey = useMemo(() => ['adminFeedback', { limit, offset }], [limit, offset]);
  const query = useQuery({
    queryKey,
    queryFn: () => getAdminFeedback({ limit, offset }),
    staleTime: 10_000
  });

  useEffect(() => {
    if (query.error instanceof HttpError && query.error.status === 401) {
      logout();
      navigate('/login', { replace: true });
    }
  }, [logout, navigate, query.error]);

  useEffect(() => {
    const socket = connectAdminSocket();
    const onCreated = () => {
      queryClient.invalidateQueries({ queryKey: ['adminFeedback'] });
    };
    socket.on('admin:feedback:created', onCreated);
    return () => {
      socket.off('admin:feedback:created', onCreated);
      socket.disconnect();
    };
  }, [queryClient]);

  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="container">
      <div className="card">
        <div className="cardHeader">
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Feedback</div>
            <div className="muted" style={{ fontSize: 13 }}>
              Reviews submitted by users
            </div>
          </div>
          <div className="row">
            <Link className="button" to="/dashboard">
              Dashboard
            </Link>
            <Link className="button" to="/users">
              Users
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
            <button
              className="button"
              type="button"
              onClick={() => {
                query.refetch();
              }}
              disabled={query.isFetching}
            >
              {query.isFetching ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          {query.isLoading ? <div className="muted">Loading…</div> : null}
          {query.isError ? (
            <div className="error">{query.error instanceof Error ? query.error.message : 'Failed to load feedback'}</div>
          ) : null}

          {query.data ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left' }}>
                    <th style={{ padding: '10px 8px' }}>ID</th>
                    <th style={{ padding: '10px 8px' }}>User</th>
                    <th style={{ padding: '10px 8px' }}>Rating</th>
                    <th style={{ padding: '10px 8px' }}>Comment</th>
                    <th style={{ padding: '10px 8px' }}>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((f) => (
                    <tr key={f.id} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <td style={{ padding: '10px 8px' }}>{f.id}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ fontWeight: 700 }}>{f.user?.username ?? `User ${f.userId}`}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          #{f.userId}
                        </div>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <Rating value={f.rating} />
                      </td>
                      <td style={{ padding: '10px 8px', maxWidth: 520, whiteSpace: 'pre-wrap' }}>{f.comment}</td>
                      <td style={{ padding: '10px 8px' }}>{formatDate(f.createdAt)}</td>
                    </tr>
                  ))}
                  {query.data.items.length === 0 ? (
                    <tr style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <td className="muted" style={{ padding: '10px 8px' }} colSpan={5}>
                        No feedback yet
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}

          {query.data ? (
            <div className="row">
              <div className="muted" style={{ fontSize: 12 }}>
                {total} feedback{total === 1 ? '' : 's'}
              </div>
              <div className="spacer" />
              <button
                className="button"
                type="button"
                onClick={() => setOffset((o) => Math.max(0, o - limit))}
                disabled={offset <= 0}
              >
                Prev
              </button>
              <div className="muted" style={{ fontSize: 12 }}>
                Page {currentPage} / {totalPages}
              </div>
              <button
                className="button"
                type="button"
                onClick={() => setOffset((o) => (o + limit >= total ? o : o + limit))}
                disabled={offset + limit >= total}
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
