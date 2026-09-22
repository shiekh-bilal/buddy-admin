import React, { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  getAdminStats,
  getAdminTimeSeries,
  type TimeSeriesPoint
} from '../../api/admin';
import { HttpError } from '../../api/http';
import { useAuth } from '../../features/auth/AuthProvider';
import { connectAdminSocket, type AdminStats } from '../../realtime/adminSocket';
import { AppShell } from '../../shared/layout/AppShell';
import { IconRefresh } from '../../shared/layout/icons';

const DISPLAY_TZ = 'America/New_York';

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

function formatInEastern(input: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: DISPLAY_TZ,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    ...opts
  }).format(new Date(input));
}

function formatEasternDate(input: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: DISPLAY_TZ,
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(new Date(input));
}

function formatPct(rate: number | null): string {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) return '-';
  return `${(rate * 100).toFixed(1)}%`;
}

function StatCard(props: { label: string; value: string; helper?: React.ReactNode }) {
  return (
    <div className="kpiTile">
      <div className="kpiLabel">{props.label}</div>
      <div className="kpiValue">{props.value}</div>
      {props.helper ? <div className="kpiHelper">{props.helper}</div> : null}
    </div>
  );
}

function RetentionCard(props: {
  label: string;
  returned: number;
  eligible: number;
  rate: number | null;
}) {
  return (
    <div className="kpiTile">
      <div className="kpiLabel">{props.label}</div>
      <div className="kpiValue">{formatNumber(props.returned)}</div>
      <div className="kpiRate">
        <strong>{formatPct(props.rate)}</strong>{' '}
        <span className="muted">of {formatNumber(props.eligible)} eligible</span>
      </div>
    </div>
  );
}

type ChartDatum = TimeSeriesPoint & { label: string };

const TIME_SERIES_WINDOW_DAYS = 30;

function SessionsTrendChart({ points }: { points: TimeSeriesPoint[] }) {
  const data: ChartDatum[] = points.map((p) => ({ ...p, label: p.date.slice(5) }));
  return (
    <div className="chartWrap">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="rgba(238,242,255,0.6)"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis
            stroke="rgba(238,242,255,0.6)"
            tick={{ fontSize: 11 }}
            width={36}
            allowDecimals
          />
          <Tooltip
            contentStyle={{
              background: '#0b1220',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 8,
              color: '#eef2ff'
            }}
            labelStyle={{ color: '#eef2ff', fontWeight: 700 }}
            itemStyle={{ color: '#a5b4fc' }}
            formatter={(value) => (typeof value === 'number' ? value.toFixed(2) : String(value ?? ''))}
            labelFormatter={(label) => `Day ${String(label ?? '')} (ET)`}
          />
          <Line
            type="monotone"
            dataKey="avgSessionsPerUser"
            name="Avg sessions / user"
            stroke="#a5b4fc"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#a5b4fc' }}
          />
        </LineChart>
      </ResponsiveContainer>
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

  const timeSeriesQuery = useQuery({
    queryKey: ['adminTimeSeries', TIME_SERIES_WINDOW_DAYS],
    queryFn: () => getAdminTimeSeries(TIME_SERIES_WINDOW_DAYS),
    staleTime: 60_000
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

  const refreshButton = useMemo(
    () => (
      <button
        className="button"
        type="button"
        onClick={() => {
          query.refetch();
          timeSeriesQuery.refetch();
        }}
        disabled={query.isFetching || timeSeriesQuery.isFetching}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <IconRefresh size={16} />
          {query.isFetching || timeSeriesQuery.isFetching ? 'Refreshing…' : 'Refresh'}
        </span>
      </button>
    ),
    [query, timeSeriesQuery]
  );

  return (
    <AppShell topBarAction={refreshButton}>
      <div className="container">
        <div className="card">
          <div className="cardHeader">
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>
                Buddy analytics
                <span className="tzBadge">Eastern Time · auto EST/EDT</span>
              </div>
              <div className="muted" style={{ fontSize: 13 }}>
                Real-time growth, engagement and retention metrics
              </div>
            </div>
          </div>
        <div className="cardBody">
          {query.isLoading ? <div className="muted">Loading…</div> : null}
          {query.isError && !(query.error instanceof HttpError && query.error.status === 401) ? (
            <div className="error">{query.error instanceof Error ? query.error.message : 'Failed to load stats'}</div>
          ) : null}

          {query.data ? (
            <div style={{ display: 'grid', gap: 20 }}>
              {/* Growth trend */}
              <section>
                <div className="chartHeader">
                  <div>
                    <div className="chartTitle">Sessions per user · last {TIME_SERIES_WINDOW_DAYS} days</div>
                    <div className="chartSubtitle">
                      Daily average, computed in Eastern Time
                    </div>
                  </div>
                  {query.data.avgSessionsPerUser !== null ? (
                    <div style={{ textAlign: 'right' }}>
                      <div className="kpiLabel">7-day avg</div>
                      <div style={{ fontSize: 22, fontWeight: 800 }}>
                        {query.data.avgSessionsPerUser.toFixed(2)}
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="divider" style={{ margin: '12px 0' }} />
                {timeSeriesQuery.isLoading ? (
                  <div className="muted" style={{ padding: '32px 0', textAlign: 'center' }}>
                    Loading trend…
                  </div>
                ) : timeSeriesQuery.isError ? (
                  <div className="error">Failed to load trend data</div>
                ) : timeSeriesQuery.data && timeSeriesQuery.data.points.length > 0 ? (
                  <SessionsTrendChart points={timeSeriesQuery.data.points} />
                ) : (
                  <div className="muted" style={{ padding: '32px 0', textAlign: 'center' }}>
                    No session data in the last {TIME_SERIES_WINDOW_DAYS} days.
                  </div>
                )}
              </section>

              {/* Activity */}
              <section>
                <div className="sectionTitle">Activity</div>
                <div className="grid">
                  <StatCard
                    label="Total Users"
                    value={formatNumber(query.data.totalUsers)}
                  />
                  <StatCard
                    label="New Users Today"
                    value={formatNumber(query.data.newUsersToday)}
                    helper={`Since ${formatInEastern(query.data.dauStart)}`}
                  />
                  <StatCard
                    label="New Users (7d)"
                    value={formatNumber(query.data.newUsersThisWeek)}
                    helper={`Since ${formatInEastern(query.data.wauStart)}`}
                  />
                  <StatCard
                    label="Active Today (DAU)"
                    value={formatNumber(query.data.dau)}
                    helper={`Since ${formatInEastern(query.data.dauStart)}`}
                  />
                  <StatCard
                    label="Active 7d (WAU)"
                    value={formatNumber(query.data.wau)}
                    helper={`Since ${formatInEastern(query.data.wauStart)}`}
                  />
                  <StatCard
                    label="Active 30d (MAU)"
                    value={formatNumber(query.data.mau)}
                    helper={`Since ${formatInEastern(query.data.mauStart)}`}
                  />
                </div>
              </section>

              {/* Engagement */}
              <section>
                <div className="sectionTitle">Engagement</div>
                <div className="grid">
                  <StatCard
                    label="Total Messages"
                    value={formatNumber(query.data.totalMessagesSent)}
                  />
                  <StatCard
                    label="Messages Today"
                    value={formatNumber(query.data.messagesSentToday)}
                    helper={`Since ${formatInEastern(query.data.dauStart)}`}
                  />
                  <StatCard
                    label="Direct Messages · All Time"
                    value={formatNumber(query.data.totalDirectMessagesSent)}
                  />
                  <StatCard
                    label="Direct Messages Today"
                    value={formatNumber(query.data.directMessagesSentToday)}
                  />
                  <StatCard
                    label="Away Messages Today"
                    value={formatNumber(query.data.awayMessagesCreatedToday)}
                  />
                  <StatCard
                    label="Away Messages · Total"
                    value={formatNumber(query.data.totalAwayMessages)}
                  />
                </div>
              </section>

              {/* Retention */}
              <section>
                <div className="sectionTitle">Retention</div>
                <div className="kpiRow">
                  <RetentionCard
                    label="D1 Retention"
                    returned={query.data.returnedAfterDay1}
                    eligible={query.data.retentionEligibleDay1}
                    rate={query.data.retentionRateDay1}
                  />
                  <RetentionCard
                    label="D7 Retention"
                    returned={query.data.returnedAfterDay7}
                    eligible={query.data.retentionEligibleDay7}
                    rate={query.data.retentionRateDay7}
                  />
                  <RetentionCard
                    label="D30 Retention"
                    returned={query.data.returnedAfterDay30}
                    eligible={query.data.retentionEligibleDay30}
                    rate={query.data.retentionRateDay30}
                  />
                </div>
                <div className="grid" style={{ marginTop: 12 }}>
                  <StatCard
                    label="Avg Sessions / User (7d)"
                    value={query.data.avgSessionsPerUser === null ? '-' : query.data.avgSessionsPerUser.toFixed(2)}
                    helper={`Since ${formatInEastern(query.data.wauStart)}`}
                  />
                  <StatCard
                    label="Avg Time Spent (7d)"
                    value={formatDuration(query.data.avgTimeSpentSeconds)}
                    helper="Per session"
                  />
                </div>
              </section>

              {/* Rooms */}
              <section>
                <div className="sectionTitle">Rooms</div>
                <div className="grid">
                  <StatCard
                    label="Active Rooms"
                    value={formatNumber(query.data.activeRooms)}
                  />
                  <StatCard
                    label="Rooms Created Today"
                    value={formatNumber(query.data.roomsCreatedToday)}
                  />
                  <StatCard
                    label="Total Room Messages"
                    value={formatNumber(query.data.totalRoomMessages)}
                  />
                  <StatCard
                    label="Most Active Room (7d)"
                    value={query.data.mostActiveRoom ? query.data.mostActiveRoom.name : '-'}
                    helper={
                      query.data.mostActiveRoom
                        ? `${formatNumber(query.data.mostActiveRoom.messageCount)} messages`
                        : undefined
                    }
                  />
                  <StatCard
                    label="Users in Rooms Now"
                    value={formatNumber(query.data.currentConcurrentUsersInRooms)}
                  />
                  <StatCard
                    label="Peak Concurrent Today"
                    value={formatNumber(query.data.peakConcurrentUsersInRoomsToday)}
                  />
                </div>
              </section>

              {/* Deleted Accounts */}
              <section>
                <div className="sectionTitle">Deleted Accounts</div>
                <div className="grid">
                  <StatCard
                    label="Deleted Today"
                    value={formatNumber(query.data.deletedAccountsToday)}
                    helper={`Since ${formatInEastern(query.data.dauStart)}`}
                  />
                  <StatCard
                    label="Deleted (7d)"
                    value={formatNumber(query.data.deletedAccountsLast7Days)}
                    helper={`Since ${formatInEastern(query.data.wauStart)}`}
                  />
                  <StatCard
                    label="Deleted (30d)"
                    value={formatNumber(query.data.deletedAccountsLast30Days)}
                    helper={`Since ${formatInEastern(query.data.mauStart)}`}
                  />
                  <StatCard
                    label="Deleted · All Time"
                    value={formatNumber(query.data.deletedAccountsAllTime)}
                  />
                  <StatCard
                    label="Deletion Rate"
                    value={formatPct(query.data.deletionRate)}
                    helper="Deleted / (Deleted + Active)"
                  />
                </div>
                <div style={{ overflowX: 'auto', marginTop: 12 }}>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                    Recently deleted accounts (last 30 days, most recent first)
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left' }}>
                        <th style={{ padding: '10px 8px' }}>User</th>
                        <th style={{ padding: '10px 8px' }}>Email</th>
                        <th style={{ padding: '10px 8px' }}>Campus</th>
                        <th style={{ padding: '10px 8px' }}>Joined (ET)</th>
                        <th style={{ padding: '10px 8px' }}>Deleted (ET)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {query.data.recentlyDeletedAccounts.map((u) => (
                        <tr
                          key={u.id}
                          style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
                        >
                          <td style={{ padding: '10px 8px' }}>
                            {u.username} <span className="muted">#{u.id}</span>
                          </td>
                          <td style={{ padding: '10px 8px' }}>{u.email || '-'}</td>
                          <td style={{ padding: '10px 8px' }}>{u.campus || '-'}</td>
                          <td style={{ padding: '10px 8px' }}>{formatInEastern(u.createdAt)}</td>
                          <td style={{ padding: '10px 8px' }}>{formatInEastern(u.deletedAt)}</td>
                        </tr>
                      ))}
                      {query.data.recentlyDeletedAccounts.length === 0 ? (
                        <tr style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                          <td
                            className="muted"
                            style={{ padding: '10px 8px' }}
                            colSpan={5}
                          >
                            No deletions in the last 30 days
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Users tables */}
              <section>
                <div className="sectionTitle">Users</div>
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
                          <th style={{ padding: '10px 8px' }}>Created (ET)</th>
                          <th style={{ padding: '10px 8px' }}>Last Seen (ET)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {query.data.newestUsers.map((u) => (
                          <tr key={u.id} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                            <td style={{ padding: '10px 8px' }}>
                              {u.username} <span className="muted">#{u.id}</span>{' '}
                              <span className="muted">{u.email}</span>
                            </td>
                            <td style={{ padding: '10px 8px' }}>{formatInEastern(u.createdAt)}</td>
                            <td style={{ padding: '10px 8px' }}>
                              {u.lastSeen ? formatInEastern(u.lastSeen) : '-'}
                            </td>
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
              </section>

              <div className="muted" style={{ fontSize: 12, textAlign: 'right' }}>
                Snapshot at {formatInEastern(query.data.asOf)} · {query.data.timeZone}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      </div>
    </AppShell>
  );
}