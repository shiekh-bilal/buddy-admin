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

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '-';
  if (!Number.isFinite(seconds) || seconds < 0) return '-';
  const s = Math.floor(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm}m`;
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
    console.log("socket = ", socket);
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
            <Link className="button" to="/rooms">
              Rooms
            </Link>
            <Link className="button" to="/reports">
              Reports
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
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>Activity</div>
                <div className="grid">
                  <StatCard label="Total Users" value={formatNumber(query.data.totalUsers)} />
                  <StatCard label="New Users Today" value={formatNumber(query.data.newUsersToday)} helper={`Since ${new Date(query.data.dauStart).toLocaleString()}`} />
                  <StatCard label="New Users (7d)" value={formatNumber(query.data.newUsersThisWeek)} helper={`Since ${new Date(query.data.wauStart).toLocaleString()}`} />
                  <StatCard label="DAU" value={formatNumber(query.data.dau)} helper={`Since ${new Date(query.data.dauStart).toLocaleString()}`} />
                  <StatCard label="WAU" value={formatNumber(query.data.wau)} helper={`Since ${new Date(query.data.wauStart).toLocaleString()}`} />
                  <StatCard label="MAU" value={formatNumber(query.data.mau)} helper={`Since ${new Date(query.data.mauStart).toLocaleString()}`} />
                </div>
              </div>

              <div>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>Engagement</div>
                <div className="grid">
                  <StatCard label="Total Messages Sent" value={formatNumber(query.data.totalMessagesSent)} />
                  <StatCard label="Messages Sent Today" value={formatNumber(query.data.messagesSentToday)} />
                  <StatCard label="Direct Messages Total" value={formatNumber(query.data.totalDirectMessagesSent)} />
                  <StatCard label="Direct Messages Today" value={formatNumber(query.data.directMessagesSentToday)} />
                  <StatCard label="Away Messages Today" value={formatNumber(query.data.awayMessagesCreatedToday)} />
                  <StatCard label="Total Away Messages" value={formatNumber(query.data.totalAwayMessages)} />
                </div>
              </div>

              <div>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>Retention</div>
                <div className="grid">
                  <StatCard label="Returned After Day 1" value={formatNumber(query.data.returnedAfterDay1)} />
                  <StatCard label="Returned After Day 7" value={formatNumber(query.data.returnedAfterDay7)} />
                  <StatCard
                    label="Avg Sessions / User (7d)"
                    value={query.data.avgSessionsPerUser === null ? '-' : query.data.avgSessionsPerUser.toFixed(2)}
                    helper={`Since ${new Date(query.data.wauStart).toLocaleString()}`}
                  />
                  <StatCard
                    label="Avg Time Spent (7d)"
                    value={formatDuration(query.data.avgTimeSpentSeconds)}
                    helper={`Per session`}
                  />
                </div>
              </div>

              <div>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>Rooms</div>
                <div className="grid">
                  <StatCard label="Active Rooms" value={formatNumber(query.data.activeRooms)} />
                  <StatCard label="Rooms Created Today" value={formatNumber(query.data.roomsCreatedToday)} />
                  <StatCard label="Total Room Messages" value={formatNumber(query.data.totalRoomMessages)} />
                  <StatCard
                    label="Most Active Room (7d)"
                    value={query.data.mostActiveRoom ? query.data.mostActiveRoom.name : '-'}
                    helper={
                      query.data.mostActiveRoom
                        ? `${formatNumber(query.data.mostActiveRoom.messageCount)} msgs`
                        : undefined
                    }
                  />
                  <StatCard label="Concurrent Users in Rooms" value={formatNumber(query.data.currentConcurrentUsersInRooms)} />
                  <StatCard label="Peak Concurrent (Today)" value={formatNumber(query.data.peakConcurrentUsersInRoomsToday)} />
                </div>
              </div>

              <div>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>Users</div>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ overflowX: 'auto' }}>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                      Most active users (7d)
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ textAlign: 'left' }}>
                          <th style={{ padding: '10px 8px' }}>User</th>
                          <th style={{ padding: '10px 8px' }}>Messages</th>
                        </tr>
                      </thead>
                      <tbody>
                        {query.data.mostActiveUsers.map((u) => (
                          <tr key={u.userId} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                            <td style={{ padding: '10px 8px' }}>
                              {u.username} <span className="muted">#{u.userId}</span>
                            </td>
                            <td style={{ padding: '10px 8px' }}>{formatNumber(u.messageCount)}</td>
                          </tr>
                        ))}
                        {query.data.mostActiveUsers.length === 0 ? (
                          <tr style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                            <td className="muted" style={{ padding: '10px 8px' }} colSpan={2}>
                              No data
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                      Newest users
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ textAlign: 'left' }}>
                          <th style={{ padding: '10px 8px' }}>User</th>
                          <th style={{ padding: '10px 8px' }}>Created</th>
                          <th style={{ padding: '10px 8px' }}>Last Login</th>
                        </tr>
                      </thead>
                      <tbody>
                        {query.data.newestUsers.map((u) => (
                          <tr key={u.id} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                            <td style={{ padding: '10px 8px' }}>
                              {u.username} <span className="muted">#{u.id}</span> <span className="muted">{u.email}</span>
                            </td>
                            <td style={{ padding: '10px 8px' }}>{new Date(u.createdAt).toLocaleString()}</td>
                            <td style={{ padding: '10px 8px' }}>{u.lastSeen ? new Date(u.lastSeen).toLocaleString() : '-'}</td>
                          </tr>
                        ))}
                        {query.data.newestUsers.length === 0 ? (
                          <tr style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                            <td className="muted" style={{ padding: '10px 8px' }} colSpan={3}>
                              No data
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
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
