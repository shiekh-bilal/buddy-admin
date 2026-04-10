import React, { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { getAdminStats } from '../../api/admin';
import { HttpError } from '../../api/http';
import { useAuth } from '../../features/auth/AuthProvider';
import { connectAdminSocket, type AdminStats } from '../../realtime/adminSocket';

function formatNumber(n: number): string {
  return new Intl.NumberFormat(undefined).format(n);
}

function StatCard(props: { label: string; value: string; helper?: string }) {
  return (
    <div className="card">
      <div className="cardBody" style={{ display: 'grid', gap: 8 }}>
        <div className="muted" style={{ fontSize: 13 }}>
          {props.label}
        </div>
        <div style={{ fontSize: 28, fontWeight: 800 }}>{props.value}</div>
        {props.helper ? (
          <div className="muted" style={{ fontSize: 12 }}>
            {props.helper}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['adminStats'],
    queryFn: getAdminStats,
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
    const onStats = (stats: AdminStats) => {
      queryClient.setQueryData(['adminStats'], stats);
    };
    socket.on('admin:stats', onStats);

    return () => {
      socket.off('admin:stats', onStats);
      socket.disconnect();
    };
  }, [queryClient]);

  return (
    <div className="container">
      <div className="card">
        <div className="cardHeader">
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Dashboard</div>
            <div className="muted" style={{ fontSize: 13 }}>
              App overview metrics
            </div>
          </div>
          <div className="row">
            <Link className="button" to="/users">
              Users
            </Link>
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
            <button
              className="button"
              type="button"
              onClick={() => {
                logout();
                navigate('/login', { replace: true });
              }}
            >
              Logout
            </button>
          </div>
        </div>
        <div className="cardBody">
          {query.isLoading ? <div className="muted">Loading…</div> : null}
          {query.isError && !(query.error instanceof HttpError && query.error.status === 401) ? (
            <div className="error">{query.error instanceof Error ? query.error.message : 'Failed to load stats'}</div>
          ) : null}
          {query.data ? (
            <div style={{ display: 'grid', gap: 18 }}>
              <div className="grid">
                <StatCard label="Total Users" value={formatNumber(query.data.totalUsers)} />
                <StatCard label="DAU" value={formatNumber(query.data.dau)} helper={`Since ${new Date(query.data.dauStart).toLocaleString()}`} />
                <StatCard label="Messages Sent" value={formatNumber(query.data.messagesSent)} />
                <StatCard label="Away Messages Sent" value={formatNumber(query.data.awayMessagesSent)} />
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                As of {new Date(query.data.asOf).toLocaleString()} ({query.data.timeZone})
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
