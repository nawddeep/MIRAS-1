import type { SVGProps } from "react";

// Inline icons: 24 px grid, stroke 1.8, rounded caps and joins. No icon package.
type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const HomeIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 11 12 4l8 7" />
    <path d="M6 10v9h12v-9" />
    <path d="M10 19v-5h4v5" />
  </Svg>
);
export const PlacesIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10Z" />
    <circle cx="12" cy="11" r="2.2" />
  </Svg>
);
export const CameraIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
    <circle cx="12" cy="12" r="3.2" />
  </Svg>
);
export const StoriesIcon = (p: P) => (
  <Svg {...p}>
    <path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H12v16H6.5A1.5 1.5 0 0 1 5 18.5Z" />
    <path d="M19 5.5A1.5 1.5 0 0 0 17.5 4H12v16h5.5a1.5 1.5 0 0 0 1.5-1.5Z" />
  </Svg>
);
export const MakersIcon = (p: P) => (
  <Svg {...p}>
    <path d="M14.5 4.5 19.5 9.5 10 19H5v-5Z" />
    <path d="M12.5 6.5l5 5" />
  </Svg>
);
export const BackIcon = (p: P) => (
  <Svg {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Svg>
);
export const ArrowIcon = (p: P) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);
export const SearchIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6" />
    <path d="m20 20-4.2-4.2" />
  </Svg>
);
export const PlayIcon = (p: P) => (
  <Svg {...p}>
    <path d="M8 5.5v13l10-6.5Z" fill="currentColor" />
  </Svg>
);
export const PauseIcon = (p: P) => (
  <Svg {...p}>
    <path d="M8 5v14M16 5v14" />
  </Svg>
);
export const InfoIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8h.01" />
  </Svg>
);
export const BookmarkIcon = (p: P) => (
  <Svg {...p}>
    <path d="M7 4h10v16l-5-3.5L7 20Z" />
  </Svg>
);
export const ImageIcon = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="5" width="16" height="14" rx="2" />
    <circle cx="9" cy="10" r="1.5" />
    <path d="m20 16-4.5-4.5L7 19" />
  </Svg>
);
export const CloseIcon = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
export const CheckIcon = (p: P) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);
export const MicIcon = (p: P) => (
  <Svg {...p}>
    <rect x="9" y="3.5" width="6" height="11" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" />
  </Svg>
);
export const ClockIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);
export const TicketIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 8a2 2 0 0 0 2-2h12a2 2 0 0 0 2 2v8a2 2 0 0 0-2 2H6a2 2 0 0 0-2-2Z" />
    <path d="M10 6v12" strokeDasharray="2 2" />
  </Svg>
);

/** Lotus mark for the wordmark. Decorative. */
export const LotusMark = (p: P) => (
  <Svg {...p}>
    <path d="M12 5c1.8 2 2.6 4 2.6 6.2 0 2.6-1.2 4.8-2.6 5.8-1.4-1-2.6-3.2-2.6-5.8C9.4 9 10.2 7 12 5Z" />
    <path d="M9.6 9.2C7.6 8.6 5.5 8.9 3.5 10c1 3.4 3.6 6 8.5 7" />
    <path d="M14.4 9.2c2-.6 4.1-.3 6.1.8-1 3.4-3.6 6-8.5 7" />
    <path d="M5 19h14" />
  </Svg>
);

export const ProfileIcon = (p: P) => (<Svg {...p}><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2Z"/></Svg>);

export const PlanIcon = (p: P) => <Svg {...p}><rect x="5" y="5" width="14" height="16" rx="2"/><path d="M8 3v4M16 3v4M5 10h14M8 14h2M8 17h5"/></Svg>;

export const GridIcon = (p: P) => <Svg {...p}><circle cx="7" cy="7" r="3"/><circle cx="17" cy="7" r="3"/><circle cx="7" cy="17" r="3"/><circle cx="17" cy="17" r="3"/></Svg>;
export const RouteIcon = (p: P) => <Svg {...p}><path strokeDasharray="2 4" d="M5 20 19 4"/><path d="m14 4 5 0 0 5"/></Svg>;
export const CraftIcon = (p: P) => <Svg {...p}><path d="M9 3h6l-1 4 4 5-2 9H8l-2-9 4-5-1-4Z"/><path d="M7 12h10M10 7h4"/></Svg>;
export const MoreIcon = (p: P) => <Svg {...p}><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></Svg>;
export const MountainIcon = (p: P) => <Svg {...p}><path d="m2 20 7-12 4 6 3-10 7 16H2Z"/><path d="m14 10 2 2 2-2"/></Svg>;
export const HotelIcon = (p: P) => <Svg {...p}><path d="M3 21V5m18 16V9M3 16h18M3 9h18v7M5 9V6h5v3M3 16v3m18-3v3"/></Svg>;
export const CarIcon = (p: P) => <Svg {...p}><path d="m5 8 2-5h10l2 5M3 9h18v10H3V9Zm2 10v2m14-2v2M7 13h1m8 0h1M3 9l-1-2m19 2 1-2"/></Svg>;
export const PeopleIcon = (p: P) => <Svg {...p}><circle cx="9" cy="7" r="3"/><path d="M3 20v-3a6 6 0 0 1 12 0v3H3Zm13-8a5 5 0 0 1 5 5v3h-3M16 4a3 3 0 0 1 0 6"/></Svg>;
export const DownloadIcon = (p: P) => <Svg {...p}><path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/></Svg>;
export const BadgeIcon = (p: P) => <Svg {...p}><circle cx="12" cy="9" r="7"/><path d="m8 15-2 7 6-3 6 3-2-7m-4-11 1 3 3 1-3 2-1 3-1-3-3-2 3-1 1-3Z"/></Svg>;
export const BinocularIcon = (p: P) => <Svg {...p}><circle cx="6" cy="16" r="4"/><circle cx="18" cy="16" r="4"/><path d="m2 15 3-11h4l2 11m2 0 2-11h4l3 11M10 13h4"/></Svg>;

export const MediaIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <polygon points="10,8.5 16,12 10,15.5" fill="currentColor" stroke="none" />
    <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
  </Svg>
);

export const Studio360Icon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5c-2.8 2.5-4.5 5.5-4.5 8.5s1.7 6 4.5 8.5" />
    <path d="M12 3.5c2.8 2.5 4.5 5.5 4.5 8.5s-1.7 6-4.5 8.5" />
    <path d="M3.5 12h17" />
  </Svg>
);
