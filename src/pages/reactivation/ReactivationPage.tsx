import React, { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  getReactivationEvents,
  getReactivationOverview,
  type ReactivationActivityTypeBucket,
  type ReactivationEvent,
  type ReactivationOverview,
  type ReactivationReason,
  type ReactivationReasonBucket
} from '../../api/admin';
import { HttpError } from '../../api/http';
import { useAuth } from '../../features/auth/AuthProvider';
import { AppShell } from '../../shared/layout/AppShell';
import { IconRefresh } from '../../shared/layout/icons';

const DISPLAY_TZ = 'America/New_York';

const WINDOW_OPTIONS = [
  { days: 1, label: '1d' },
  { days: 7, label: '7d' },
  { days: 30, label: '30d' },
  { days: 90, label: '90d' }
];

const REASON_LABELS: Record<ReactivationReason, string> = {
  inactive_7d: 'Inactive 7+ days',
  inactive_14d: 'Inactive 14+ days',
  inactive_30d: 'Inactive 30+ days'
};

const REASON_HELPERS: Record<ReactivationReason, string> = {
  inactive_7d: '7–13 days since last open',
  inactive_14d: '14–29 days since last open',
  inactive_30d: '30+ days since last open'
};

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  on_fire: 'On fire',
  new_messages: 'New messages',
  just_got_busy: 'Just got busy',
  picking_up: 'Picking up',
  trending: 'Trending'
};

function formatNumber(n: number): string {
  return new Intl.NumberFormat(undefined).format(n);
}

function formatInEastern(input: string | Date | null, opts?: Intl.DateTimeFormatOptions): string {
  if (!input) return '—';
  const dt = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(dt.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: DISPLAY_TZ,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    ...opts
  }).format(dt);
}

function formatRelative(input: string | Date | null): string {
  if (!input) return '—';
  const dt = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(dt.getTime())) return '—';
  const diffMs = Date.now() - dt.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month}mo ago`;
  const year = Math.floor(day / 365);
  return `${year}y ago`;
}

function formatPct(rate: number | null | undefined, digits = 1): string {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) return '—';
  return `${(rate * 100).toFixed(digits)}%`;
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

function bucketForReason(reason: ReactivationReason, overview: ReactivationOverview): ReactivationReasonBucket {
  return overview.byReason[reason] || { sent: 0, opened: 0, openRate: 0, distinctUsers: 0 };
}

export function ReactivationPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [windowDays, setWindowDays] = React.useState<number>(7);
  const [page, setPage] = React.useState<number>(1);
  const pageSize = 25;

  const overviewQuery = useQuery({
    queryKey: ['reactivationOverview', windowDays],
    queryFn: () => getReactivationOverview({ sinceDays: windowDays }),
    staleTime: 15_000
  });

  const eventsQuery = useQuery({
    queryKey: ['reactivationEvents', page, pageSize],
    queryFn: () => getReactivationEvents({ page, pageSize }),
    staleTime: 15_000
  });

  useEffect(() => {
    if (overviewQuery.error instanceof HttpError && overviewQuery.error.status === 401) {
      logout();
      navigate('/login', { replace: true });
    }
  }, [logout, navigate, overviewQuery.error]);

  // Reset pagination if the user changes the time window so we don't strand
  // them on a page that no longer exists in the new result set.
  useEffect(() => {
    setPage(1);
  }, [windowDays]);

  const isLoading = overviewQuery.isLoading || eventsQuery.isLoading;
  const isFetching = overviewQuery.isFetching || eventsQuery.isFetching;

  const refreshButton = useMemo(
    () => (
      <button
        className="button"
        type="button"
        onClick={() => {
          overviewQuery.refetch();
          eventsQuery.refetch();
        }}
        disabled={isFetching}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <IconRefresh size={16} />
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </span>
      </button>
    ),
    [overviewQuery, eventsQuery, isFetching]
  );

  const overview: ReactivationOverview | undefined = overviewQuery.data;
  const events: ReactivationEvent[] = eventsQuery.data?.items ?? [];
  const eventsTotal = eventsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(eventsTotal / pageSize));

  const reasonBuckets: { reason: ReactivationReason; bucket: ReactivationReasonBucket }[] = overview
    ? [
        { reason: 'inactive_30d', bucket: bucketForReason('inactive_30d', overview) },
        { reason: 'inactive_14d', bucket: bucketForReason('inactive_14d', overview) },
        { reason: 'inactive_7d', bucket: bucketForReason('inactive_7d', overview) }
      ]
    : [];

  const activityTypeEntries: [string, ReactivationActivityTypeBucket][] = overview
    ? Object.entries(overview.byActivityType).sort(
        (a, b) => (b[1].sent || 0) - (a[1].sent || 0)
      )
    : [];

  return (
    <AppShell topBarAction={refreshButton}>
      <div className="container">
        <div className="card">
          <div className="cardHeader">
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>
                Reactivation
                <span className="tzBadge">Eastern Time · auto EST/EDT</span>
              </div>
              <div className="muted" style={{ fontSize: 13 }}>
                Push notifications for inactive users · open-rate tracks
                whether dormant users return to the app
              </div>
            </div>
            <div className="row">
              <span className="muted" style={{ fontSize: 12 }}>Window</span>
              {WINDOW_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  type="button"
                  className={`button ${windowDays === opt.days ? 'buttonPrimary' : ''}`}
                  onClick={() => setWindowDays(opt.days)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="cardBody" style={{ display: 'grid', gap: 20 }}>
            {isLoading ? <div className="muted">Loading…</div> : null}
            {overviewQuery.isError && !(overviewQuery.error instanceof HttpError && overviewQuery.error.status === 401) ? (
              <div className="error">
                {overviewQuery.error instanceof Error ? overviewQuery.error.message : 'Failed to load overview'}
              </div>
            ) : null}

            {overview ? (
              <>
                <section>
                  <div className="sectionTitle">
                    Last {windowDays} {windowDays === 1 ? 'day' : 'days'}
                  </div>
                  <div className="grid">
                    <StatCard
                      label="Pushes sent"
                      value={formatNumber(overview.totals.sent)}
                      helper={`${formatNumber(overview.totals.distinctUsers)} dormant user${overview.totals.distinctUsers === 1 ? '' : 's'}`}
                    />
                    <StatCard
                      label="Opened"
                      value={formatNumber(overview.totals.opened)}
                      helper={overview.totals.sent > 0 ? `${formatPct(overview.totals.openRate)} of sends` : 'No sends yet'}
                    />
                    <StatCard
                      label="Open rate"
                      value={formatPct(overview.totals.openRate)}
                      helper="Opened ÷ sent"
                    />
                    <StatCard
                      label="Distinct users reached"
                      value={formatNumber(overview.totals.distinctUsers)}
                    />
                  </div>
                </section>

                <section>
                  <div className="sectionTitle">By inactivity bucket</div>
                  <div className="grid">
                    {reasonBuckets.map(({ reason, bucket }) => (
                      <StatCard
                        key={reason}
                        label={REASON_LABELS[reason]}
                        value={`${formatNumber(bucket.sent)} sent · ${formatNumber(bucket.opened)} opened`}
                        helper={
                          <>
                            <strong>{formatPct(bucket.openRate)}</strong>{' '}
                            <span className="muted">{REASON_HELPERS[reason]}</span>
                          </>
                        }
                      />
                    ))}
                  </div>
                </section>

                {activityTypeEntries.length > 0 ? (
                  <section>
                    <div className="sectionTitle">By triggering activity</div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ textAlign: 'left' }}>
                            <th style={{ padding: '10px 8px' }}>Activity</th>
                            <th style={{ padding: '10px 8px', textAlign: 'right' }}>Sent</th>
                            <th style={{ padding: '10px 8px', textAlign: 'right' }}>Opened</th>
                            <th style={{ padding: '10px 8px', textAlign: 'right' }}>Open rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activityTypeEntries.map(([type, b]) => (
                            <tr
                              key={type}
                              style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
                            >
                              <td style={{ padding: '10px 8px' }}>
                                {ACTIVITY_TYPE_LABELS[type] || type}
                              </td>
                              <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatNumber(b.sent)}</td>
                              <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatNumber(b.opened)}</td>
                              <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatPct(b.openRate)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ) : null}
              </>
            ) : null}

            <section>
              <div className="sectionTitle">Recent events</div>
              {eventsQuery.isError && !(eventsQuery.error instanceof HttpError && eventsQuery.error.status === 401) ? (
                <div className="error">Failed to load events</div>
              ) : events.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left' }}>
                        <th style={{ padding: '10px 8px' }}>User</th>
                        <th style={{ padding: '10px 8px' }}>Room</th>
                        <th style={{ padding: '10px 8px' }}>Reason</th>
                        <th style={{ padding: '10px 8px' }}>Activity</th>
                        <th style={{ padding: '10px 8px' }}>Push</th>
                        <th style={{ padding: '10px 8px' }}>Sent</th>
                        <th style={{ padding: '10px 8px' }}>Opened</th>
                        <th style={{ padding: '10px 8px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((e) => (
                        <tr
                          key={e.id}
                          style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
                        >
                          <td style={{ padding: '10px 8px' }}>
                            {e.username || '—'} <span className="muted">#{e.userId}</span>
                            {e.userIsBanned ? (
                              <span className="muted" style={{ marginLeft: 6, fontSize: 11 }}>(banned)</span>
                            ) : null}
                            {e.userIsDeleted ? (
                              <span className="muted" style={{ marginLeft: 6, fontSize: 11 }}>(deleted)</span>
                            ) : null}
                          </td>
                          <td style={{ padding: '10px 8px' }}>
                            {e.roomName || e.roomKey || '—'}{' '}
                            <span className="muted">#{e.roomId}</span>
                          </td>
                          <td style={{ padding: '10px 8px' }}>{REASON_LABELS[e.reason]}</td>
                          <td style={{ padding: '10px 8px' }}>
                            {ACTIVITY_TYPE_LABELS[e.activityType] || e.activityType}
                          </td>
                          <td
                            style={{
                              padding: '10px 8px',
                              maxWidth: 280,
                              whiteSpace: 'normal'
                            }}
                          >
                            <div style={{ fontWeight: 600 }}>{e.title}</div>
                            <div className="muted" style={{ fontSize: 12 }}>{e.body}</div>
                          </td>
                          <td style={{ padding: '10px 8px' }}>{formatRelative(e.sentAt)}</td>
                          <td style={{ padding: '10px 8px' }}>
                            {e.openedAt ? formatRelative(e.openedAt) : '—'}
                          </td>
                          <td style={{ padding: '10px 8px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 10px',
                                borderRadius: 999,
                                fontSize: 11,
                                background: e.openedAt
                                  ? 'rgba(99,102,241,0.32)'
                                  : 'rgba(255,255,255,0.08)',
                                border: e.openedAt
                                  ? '1px solid rgba(99,102,241,0.7)'
                                  : '1px solid rgba(255,255,255,0.18)',
                                color: '#eef2ff'
                              }}
                            >
                              {e.openedAt ? 'Opened' : 'Sent'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="row" style={{ marginTop: 12, justifyContent: 'space-between' }}>
                    <span className="muted" style={{ fontSize: 12 }}>
                      Showing {formatNumber(events.length)} of {formatNumber(eventsTotal)} events
                    </span>
                    <div className="row">
                      <button
                        className="button"
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1 || eventsQuery.isFetching}
                      >
                        Previous
                      </button>
                      <span className="muted" style={{ fontSize: 12 }}>
                        Page {page} of {totalPages}
                      </span>
                      <button
                        className="button"
                        type="button"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages || eventsQuery.isFetching}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="muted" style={{ padding: '24px 0', textAlign: 'center' }}>
                  No reactivation events yet.
                </div>
              )}
            </section>

            {overview ? (
              <div className="muted" style={{ fontSize: 12, textAlign: 'right' }}>
                Snapshot at {formatInEastern(overview.asOf)} · {DISPLAY_TZ}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}