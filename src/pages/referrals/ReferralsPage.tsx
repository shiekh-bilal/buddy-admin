import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  getReferralFunnel,
  getReferralInviterDetail,
  getReferralLeaderboard,
  type ReferralLeaderboardItem,
  type ReferralReferee
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

function formatRatePair(active: number, eligible: number): string {
  if (eligible <= 0) return `${active}/0`;
  return `${active}/${eligible} (${formatPct(active / eligible)})`;
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

// Categorize one referee into a funnel bucket. The categories are mutually
// exclusive and ordered to match what the admin wants to see at a glance:
// who's actually "still active after 7 days" (best), who's activated but
// drifted, who only signed up but never came back, and who hasn't been a
// member of the cohort long enough to measure yet.
type RefereeBucket = 'active' | 'activated' | 'signedUp' | 'notEligible';

function bucketFor(referee: ReferralReferee): RefereeBucket {
  if (!referee.eligibleFor7dCheck) return 'notEligible';
  if (referee.activatedAt && referee.isActive7d) return 'active';
  if (referee.activatedAt) return 'activated';
  return 'signedUp';
}

const BUCKET_LABEL: Record<RefereeBucket, string> = {
  active: 'Activated + still active 7d+',
  activated: 'Activated · inactive 7d',
  signedUp: 'Signed up only',
  notEligible: 'Referred < 7d ago (cohort not yet measurable)'
};

const BUCKET_SORT: Record<RefereeBucket, number> = {
  active: 0,
  activated: 1,
  signedUp: 2,
  notEligible: 3
};

export function ReferralsPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [windowDays, setWindowDays] = useState<number>(7);
  const [selectedInviterId, setSelectedInviterId] = useState<number | null>(null);

  const leaderboardQuery = useQuery({
    queryKey: ['referralLeaderboard', windowDays],
    queryFn: () => getReferralLeaderboard({ windowDays, page: 1, pageSize: 50 }),
    staleTime: 15_000
  });

  // Global funnel uses a fixed 30-day window so the top KPI tiles don't jump
  // every time the user toggles the leaderboard window. The leaderboard is
  // the time-varying view; the funnel is the steady-state one.
  const funnelQuery = useQuery({
    queryKey: ['referralFunnel'],
    queryFn: () => getReferralFunnel({ sinceDays: 30 }),
    staleTime: 15_000
  });

  const detailQuery = useQuery({
    queryKey: ['referralInviterDetail', selectedInviterId],
    queryFn: () => getReferralInviterDetail(selectedInviterId as number),
    enabled: typeof selectedInviterId === 'number',
    staleTime: 15_000
  });

  useEffect(() => {
    if (leaderboardQuery.error instanceof HttpError && leaderboardQuery.error.status === 401) {
      logout();
      navigate('/login', { replace: true });
    }
  }, [logout, navigate, leaderboardQuery.error]);

  // Reset the detail panel if the leaderboard window changes while a row is
  // selected — the cached drill-down is bound to the inviter, not the window,
  // so leaving the panel open across window switches is fine, but clearing
  // it on a deliberate "I want to look at a different window" action is
  // less confusing.
  useEffect(() => {
    setSelectedInviterId(null);
  }, [windowDays]);

  const isLoading = leaderboardQuery.isLoading || funnelQuery.isLoading;
  const isFetching = leaderboardQuery.isFetching || funnelQuery.isFetching;

  const refreshButton = useMemo(
    () => (
      <button
        className="button"
        type="button"
        onClick={() => {
          leaderboardQuery.refetch();
          funnelQuery.refetch();
          if (selectedInviterId !== null) detailQuery.refetch();
        }}
        disabled={isFetching}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <IconRefresh size={16} />
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </span>
      </button>
    ),
    [leaderboardQuery, funnelQuery, detailQuery, isFetching, selectedInviterId]
  );

  // Compute per-row drill-down buckets once when the detail loads, so the
  // mini-tiles stay in sync with the per-referee table even if the row order
  // changes below. `detailItems` is memoized so the bucket memo's reference
  // equality holds across renders when the data hasn't changed (otherwise
  // eslint-react-hooks complains the bucket dep changes on every render).
  const detailItems = useMemo(
    () => detailQuery.data?.items ?? [],
    [detailQuery.data]
  );
  const buckets = useMemo(() => {
    const counts: Record<RefereeBucket, number> = {
      active: 0,
      activated: 0,
      signedUp: 0,
      notEligible: 0
    };
    for (const r of detailItems) counts[bucketFor(r)] += 1;
    return counts;
  }, [detailItems]);

  const selectedRow = useMemo(() => {
    if (selectedInviterId === null) return null;
    return (
      leaderboardQuery.data?.items.find((row) => row.inviterUserId === selectedInviterId) ?? null
    );
  }, [leaderboardQuery.data, selectedInviterId]);

  return (
    <AppShell topBarAction={refreshButton}>
      <div className="container">
        <div className="card">
          <div className="cardHeader">
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>Referral funnel</div>
              <div className="muted" style={{ fontSize: 13 }}>
                Per-inviter signups, activation and 7-day retention on the referred cohort
                <span className="tzBadge">Eastern Time · auto EST/EDT</span>
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
            {funnelQuery.isError && !(funnelQuery.error instanceof HttpError && funnelQuery.error.status === 401) ? (
              <div className="error">{funnelQuery.error instanceof Error ? funnelQuery.error.message : 'Failed to load funnel'}</div>
            ) : null}

            {funnelQuery.data ? (
              <section>
                <div className="sectionTitle">Last 30 days</div>
                <div className="grid">
                  <StatCard
                    label="Signups"
                    value={formatNumber(funnelQuery.data.signups)}
                    helper="Completed referrals"
                  />
                  <StatCard
                    label="Activated"
                    value={formatNumber(funnelQuery.data.activated)}
                    helper={
                      <>
                        <strong>{formatPct(funnelQuery.data.activationRate)}</strong> of signups
                      </>
                    }
                  />
                  <StatCard
                    label="Active after 7d"
                    value={formatNumber(funnelQuery.data.activeAfter7d)}
                    helper={
                      <>
                        <strong>{formatPct(funnelQuery.data.retentionRate7d)}</strong>{' '}
                        <span className="muted">
                          of {formatNumber(funnelQuery.data.eligibleAfter7d)} eligible
                        </span>
                      </>
                    }
                  />
                  <StatCard
                    label="Active in trailing 7d"
                    value={formatNumber(funnelQuery.data.active7d)}
                    helper="All referees with any recent message"
                  />
                </div>
              </section>
            ) : null}

            <section>
              <div className="sectionTitle">
                Inviters · last {windowDays} {windowDays === 1 ? 'day' : 'days'}
              </div>
              {leaderboardQuery.isLoading ? (
                <div className="muted">Loading leaderboard…</div>
              ) : leaderboardQuery.isError &&
                !(leaderboardQuery.error instanceof HttpError && leaderboardQuery.error.status === 401) ? (
                <div className="error">
                  {leaderboardQuery.error instanceof Error
                    ? leaderboardQuery.error.message
                    : 'Failed to load leaderboard'}
                </div>
              ) : leaderboardQuery.data && leaderboardQuery.data.items.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left' }}>
                        <th style={{ padding: '10px 8px' }}>Inviter</th>
                        <th style={{ padding: '10px 8px' }}>Type</th>
                        <th style={{ padding: '10px 8px', textAlign: 'right' }}>Signups</th>
                        <th style={{ padding: '10px 8px', textAlign: 'right' }}>Activated</th>
                        <th style={{ padding: '10px 8px', textAlign: 'right' }}>Active after 7d</th>
                        <th style={{ padding: '10px 8px' }}>Last referral</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboardQuery.data.items.map((row) => (
                        <LeaderboardRow
                          key={row.inviterUserId}
                          row={row}
                          selected={selectedInviterId === row.inviterUserId}
                          onSelect={() =>
                            setSelectedInviterId((current) =>
                              current === row.inviterUserId ? null : row.inviterUserId
                            )
                          }
                        />
                      ))}
                    </tbody>
                  </table>
                  <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                    Showing top {leaderboardQuery.data.items.length} of{' '}
                    {formatNumber(leaderboardQuery.data.total)} inviters · click a row to see the
                    referees
                  </div>
                </div>
              ) : (
                <div className="muted" style={{ padding: '24px 0', textAlign: 'center' }}>
                  No completed referrals in the last {windowDays} {windowDays === 1 ? 'day' : 'days'}.
                </div>
              )}
            </section>

            {selectedInviterId !== null ? (
              <DrillDownPanel
                inviter={selectedRow}
                items={detailItems}
                isLoading={detailQuery.isLoading}
                isError={detailQuery.isError}
                buckets={buckets}
                onClose={() => setSelectedInviterId(null)}
                truncated={Boolean(detailQuery.data?.truncated)}
              />
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function LeaderboardRow(props: {
  row: ReferralLeaderboardItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const { row, selected, onSelect } = props;
  return (
    <tr
      onClick={onSelect}
      style={{
        borderTop: '1px solid rgba(255,255,255,0.08)',
        cursor: 'pointer',
        background: selected ? 'rgba(99,102,241,0.18)' : 'transparent'
      }}
    >
      <td style={{ padding: '10px 8px' }}>
        {row.username} <span className="muted">#{row.inviterUserId}</span>
        {row.isBanned ? (
          <span className="muted" style={{ marginLeft: 6, fontSize: 11 }}>
            (banned)
          </span>
        ) : null}
      </td>
      <td style={{ padding: '10px 8px' }}>{row.type}</td>
      <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatNumber(row.signups)}</td>
      <td style={{ padding: '10px 8px', textAlign: 'right' }}>
        {formatNumber(row.activated)}
        {row.signups > 0 ? (
          <span className="muted" style={{ marginLeft: 6, fontSize: 11 }}>
            ({formatPct(row.activated / row.signups)})
          </span>
        ) : null}
      </td>
      <td style={{ padding: '10px 8px', textAlign: 'right' }}>
        {formatRatePair(row.activeAfter7d, row.cohortEligible7d)}
      </td>
      <td style={{ padding: '10px 8px' }}>{formatRelative(row.lastReferralAt)}</td>
    </tr>
  );
}

function DrillDownPanel(props: {
  inviter: ReferralLeaderboardItem | null;
  items: ReferralReferee[];
  isLoading: boolean;
  isError: boolean;
  buckets: Record<RefereeBucket, number>;
  onClose: () => void;
  truncated: boolean;
}) {
  const { inviter, items, isLoading, isError, buckets, onClose, truncated } = props;

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const ba = BUCKET_SORT[bucketFor(a)];
      const bb = BUCKET_SORT[bucketFor(b)];
      if (ba !== bb) return ba - bb;
      // Within a bucket, show most recently active first.
      const aLast = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
      const bLast = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
      if (bLast !== aLast) return bLast - aLast;
      return new Date(b.referredAt).getTime() - new Date(a.referredAt).getTime();
    });
  }, [items]);

  return (
    <section>
      <div className="divider" />
      <div className="card">
        <div className="cardHeader">
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>
              {inviter ? `${inviter.username} · #${inviter.inviterUserId}` : 'Inviter detail'}
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              {inviter
                ? `${formatNumber(inviter.signups)} signups · ${formatNumber(
                    inviter.activated
                  )} activated · ${formatNumber(inviter.activeAfter7d)} still active after 7d`
                : 'Per-referee breakdown'}
            </div>
          </div>
          <button className="button" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="cardBody" style={{ display: 'grid', gap: 16 }}>
          {isLoading ? <div className="muted">Loading referees…</div> : null}
          {isError ? <div className="error">Failed to load referees</div> : null}

          {!isLoading && !isError ? (
            <>
              <div className="grid">
                <StatCard
                  label="Activated + still active 7d+"
                  value={formatNumber(buckets.active)}
                  helper="Best: activated and active in trailing 7d"
                />
                <StatCard
                  label="Activated · inactive 7d"
                  value={formatNumber(buckets.activated)}
                  helper="Activated but no recent activity"
                />
                <StatCard
                  label="Signed up only"
                  value={formatNumber(buckets.signedUp)}
                  helper="Referred ≥ 7d ago, never activated"
                />
                <StatCard
                  label="Cohort not yet measurable"
                  value={formatNumber(buckets.notEligible)}
                  helper="Referred < 7d ago — D7 rate isn't defined yet"
                />
              </div>

              {sortedItems.length === 0 ? (
                <div className="muted">No completed referrals for this inviter.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left' }}>
                        <th style={{ padding: '10px 8px' }}>Referee</th>
                        <th style={{ padding: '10px 8px' }}>Referred</th>
                        <th style={{ padding: '10px 8px' }}>Activated</th>
                        <th style={{ padding: '10px 8px' }}>Last activity</th>
                        <th style={{ padding: '10px 8px' }}>Active 7d</th>
                        <th style={{ padding: '10px 8px' }}>D7 eligible</th>
                        <th style={{ padding: '10px 8px' }}>Bucket</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedItems.map((r) => {
                        const bucket = bucketFor(r);
                        return (
                          <tr key={r.referralId} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                            <td style={{ padding: '10px 8px' }}>
                              {r.username} <span className="muted">#{r.userId}</span>
                              {r.isBanned ? (
                                <span className="muted" style={{ marginLeft: 6, fontSize: 11 }}>
                                  (banned)
                                </span>
                              ) : null}
                              {r.deletedAt ? (
                                <span className="muted" style={{ marginLeft: 6, fontSize: 11 }}>
                                  (deleted)
                                </span>
                              ) : null}
                            </td>
                            <td style={{ padding: '10px 8px' }}>{formatInEastern(r.referredAt)}</td>
                            <td style={{ padding: '10px 8px' }}>
                              {r.activatedAt ? formatInEastern(r.activatedAt) : '—'}
                            </td>
                            <td style={{ padding: '10px 8px' }}>
                              {formatRelative(r.lastActivityAt)}
                            </td>
                            <td style={{ padding: '10px 8px' }}>
                              {r.eligibleFor7dCheck ? (r.isActive7d ? 'Yes' : 'No') : '—'}
                            </td>
                            <td style={{ padding: '10px 8px' }}>
                              {r.eligibleFor7dCheck ? 'Yes' : 'No'}
                            </td>
                            <td style={{ padding: '10px 8px' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: 999,
                                  fontSize: 11,
                                  background:
                                    bucket === 'active'
                                      ? 'rgba(99,102,241,0.32)'
                                      : bucket === 'activated'
                                      ? 'rgba(99,102,241,0.16)'
                                      : bucket === 'signedUp'
                                      ? 'rgba(255,255,255,0.08)'
                                      : 'rgba(255,255,255,0.04)',
                                  border:
                                    bucket === 'active'
                                      ? '1px solid rgba(99,102,241,0.7)'
                                      : '1px solid rgba(255,255,255,0.18)',
                                  color: '#eef2ff'
                                }}
                              >
                                {BUCKET_LABEL[bucket]}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {truncated ? (
                    <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                      Showing the first 200 referees; use the Users page for older or further
                      paginated history.
                    </div>
                  ) : null}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}