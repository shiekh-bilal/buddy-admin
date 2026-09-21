import React from 'react';

// Tiny inline SVG icon set so we don't have to add an icon dependency for
// the sidebar / topbar. All icons render at 1em and inherit `currentColor`,
// so they recolor with the surrounding text.
type IconProps = React.SVGProps<SVGSVGElement> & { size?: number };

function base(props: IconProps): React.SVGProps<SVGSVGElement> {
  const { size = 18, ...rest } = props;
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    focusable: false,
    ...rest
  };
}

export const IconDashboard = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);

export const IconUsers = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.5-3.3 3.2-5.5 6.5-5.5s6 2.2 6.5 5.5" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M16 14.5c2.5.3 4.3 2 4.7 4.5" />
  </svg>
);

export const IconRooms = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 5h12a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H10l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
    <path d="M8 9h6M8 12h4" />
  </svg>
);

export const IconReports = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 3v18" />
    <path d="M5 4h11l3 3v14a1 1 0 0 1-1 1H5" />
    <path d="M9 9h5M9 13h5M9 17h3" />
  </svg>
);

export const IconFeedback = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.6 6.8 19.2l1-5.9L3.5 9.2l5.9-.8L12 3z" />
  </svg>
);

export const IconSearch = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);

export const IconChevronLeft = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);

export const IconChevronRight = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export const IconMenu = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

export const IconClose = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const IconLogout = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
);

export const IconRefresh = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M20 11a8 8 0 1 0-2.3 5.7" />
    <path d="M20 4v6h-6" />
  </svg>
);

export const IconBuddy = (p: IconProps) => (
  // Buddy mark — stylized shield/badge so the brand has a unique glyph in the sidebar.
  <svg {...base(p)} viewBox="0 0 24 24">
    <path d="M12 3l7 3v6c0 4.5-3.2 8.4-7 9-3.8-.6-7-4.5-7-9V6l7-3z" />
    <path d="M9 11.5l2.2 2.2L15.5 9.5" />
  </svg>
);
