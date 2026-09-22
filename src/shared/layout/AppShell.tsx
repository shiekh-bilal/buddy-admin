import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { IconMenu } from './icons';
import { Sidebar } from './Sidebar';

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Real-time growth, engagement and retention metrics' },
  '/users': { title: 'Users', subtitle: 'Browse and manage registered users' },
  '/rooms': { title: 'Rooms', subtitle: 'Manage public rooms and memberships' },
  '/reports': { title: 'Reports', subtitle: 'Review user reports and take action' },
  '/feedback': { title: 'Feedback', subtitle: 'Reviews submitted by users' }
};

function resolvePageMeta(pathname: string): { title: string; subtitle: string } {
  // Prefer exact match; fall back to the longest known prefix so nested routes
  // (e.g. /users/123) still get a sensible title.
  if (PAGE_META[pathname]) return PAGE_META[pathname];
  const keys = Object.keys(PAGE_META).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (key !== '/' && pathname.startsWith(key + '/')) return PAGE_META[key];
  }
  return { title: 'Buddy Admin', subtitle: '' };
}

export type AppShellProps = {
  children: React.ReactNode;
  // Optional page-level actions rendered on the right side of the top bar
  // (e.g. a "Refresh" button on the Dashboard). Falls back to nothing.
  topBarAction?: React.ReactNode;
};

export function AppShell(props: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const meta = resolvePageMeta(location.pathname);

  // Lock body scroll while the mobile drawer is open so the user can't
  // scroll the underlying page behind the overlay.
  useEffect(() => {
    if (mobileOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
    return undefined;
  }, [mobileOpen]);

  return (
    <div className="appShell">
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="appMain">
        <header className="appTopBar">
          <button
            type="button"
            className="appTopBarMenu"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <IconMenu size={20} />
          </button>
          <div className="appTopBarTitle">
            <div className="appTopBarTitleText">{meta.title}</div>
            {meta.subtitle ? (
              <div className="appTopBarSubtitle">{meta.subtitle}</div>
            ) : null}
          </div>
          {props.topBarAction ? (
            <div className="appTopBarAction">{props.topBarAction}</div>
          ) : null}
        </header>
        <main className="appMainContent">{props.children}</main>
      </div>
    </div>
  );
}
