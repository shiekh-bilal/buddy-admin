import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  IconBuddy,
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconDashboard,
  IconFeedback,
  IconLogout,
  IconReports,
  IconRooms,
  IconSearch,
  IconUsers
} from './icons';
import { useAuth } from '../../features/auth/AuthProvider';

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  // Optional sub-routes that render as a nested list under the parent when the
  // parent route (or any of its children) is active. Mirrors the "CE Support →
  // Tickets / FAQs / Training" pattern from the reference layout.
  children?: { to: string; label: string }[];
};

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: IconDashboard },
  { to: '/users', label: 'Users', icon: IconUsers },
  { to: '/rooms', label: 'Rooms', icon: IconRooms },
  { to: '/reports', label: 'Reports', icon: IconReports },
  { to: '/feedback', label: 'Feedback', icon: IconFeedback }
];

const COLLAPSE_KEY = 'buddy-admin-sidebar-collapsed';

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeCollapsed(v: boolean): void {
  try {
    window.localStorage.setItem(COLLAPSE_KEY, v ? '1' : '0');
  } catch {
    // localStorage may be disabled — non-fatal, sidebar just resets each load.
  }
}

export type SidebarProps = {
  // Mobile: the sidebar is rendered as a slide-in drawer; this controls it.
  // Desktop: ignored — the sidebar is always visible and pinned to the left.
  mobileOpen: boolean;
  onMobileClose: () => void;
};

export function Sidebar(props: SidebarProps) {
  const { mobileOpen, onMobileClose } = props;
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState<boolean>(() => readCollapsed());
  const [query, setQuery] = useState('');

  useEffect(() => {
    writeCollapsed(collapsed);
  }, [collapsed]);

  // Close the mobile drawer whenever the route changes (tap a link → drawer
  // closes automatically, matches native app behavior).
  useEffect(() => {
    onMobileClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    // Quick-find: route to the Users page with the query pre-filled. UsersPage
    // reads `q` from the URL on mount and pre-populates its filter.
    navigate(`/users?q=${encodeURIComponent(trimmed)}`);
    setQuery('');
  }

  return (
    <>
      {/* Backdrop only on mobile while the drawer is open. Pointer-events:none
          on desktop so it can't intercept clicks even if a stale element is
          left in the DOM. */}
      <div
        className={`sidebarBackdrop ${mobileOpen ? 'sidebarBackdropOpen' : ''}`}
        onClick={onMobileClose}
        aria-hidden
      />
      <aside
        className={`sidebar ${collapsed ? 'sidebarCollapsed' : ''} ${mobileOpen ? 'sidebarMobileOpen' : ''}`}
        aria-label="Primary navigation"
      >
        <div className="sidebarHeader">
          <Link to="/dashboard" className="sidebarBrand" title="Buddy Admin">
            <span className="sidebarBrandMark" aria-hidden>
              <IconBuddy size={22} />
            </span>
            {!collapsed ? (
              <span className="sidebarBrandText">
                Buddy
                <span className="sidebarBrandTextSub">Admin</span>
              </span>
            ) : null}
          </Link>
          <button
            type="button"
            className="sidebarIconButton sidebarMobileClose"
            onClick={onMobileClose}
            aria-label="Close navigation"
          >
            <IconClose size={18} />
          </button>
        </div>

        {!collapsed ? (
          <form className="sidebarSearch" onSubmit={handleSearchSubmit} role="search">
            <IconSearch size={16} className="sidebarSearchIcon" />
            <input
              type="search"
              className="sidebarSearchInput"
              placeholder="Search users…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search users"
            />
          </form>
        ) : null}

        <nav className="sidebarNav">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.to ||
              (item.to !== '/' && location.pathname.startsWith(item.to + '/'));
            const showChildren = !collapsed && isActive && item.children && item.children.length > 0;
            return (
              <div key={item.to} className="sidebarNavGroup">
                <Link
                  to={item.to}
                  className={`sidebarNavItem ${isActive ? 'sidebarNavItemActive' : ''}`}
                  title={collapsed ? item.label : undefined}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="sidebarNavIcon" aria-hidden>
                    <Icon size={18} />
                  </span>
                  {!collapsed ? <span className="sidebarNavLabel">{item.label}</span> : null}
                </Link>
                {showChildren
                  ? item.children!.map((child) => {
                      const childActive = location.pathname === child.to;
                      return (
                        <Link
                          key={child.to}
                          to={child.to}
                          className={`sidebarNavSubItem ${childActive ? 'sidebarNavSubItemActive' : ''}`}
                        >
                          {child.label}
                        </Link>
                      );
                    })
                  : null}
              </div>
            );
          })}
        </nav>

        <div className="sidebarFooter">
          <button
            type="button"
            className="sidebarNavItem sidebarCollapseButton"
            onClick={() => setCollapsed((c) => !c)}
            aria-pressed={collapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="sidebarNavIcon" aria-hidden>
              {collapsed ? <IconChevronRight size={18} /> : <IconChevronLeft size={18} />}
            </span>
            {!collapsed ? <span className="sidebarNavLabel">Collapse sidebar</span> : null}
          </button>

          <button
            type="button"
            className="sidebarNavItem"
            onClick={handleLogout}
            title={collapsed ? 'Logout' : undefined}
          >
            <span className="sidebarNavIcon" aria-hidden>
              <IconLogout size={18} />
            </span>
            {!collapsed ? <span className="sidebarNavLabel">Logout</span> : null}
          </button>
        </div>
      </aside>
    </>
  );
}
