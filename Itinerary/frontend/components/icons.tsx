import type { SVGProps } from "react";

// Inline icons on a 24px grid, stroke 1.8, rounded caps (same conventions as Miras). No icon package.
type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, children, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      {children}
    </svg>
  );
}

export const HomeIcon = (p: P) => (<Svg {...p}><path d="M4 11 12 4l8 7" /><path d="M6 10v9h12v-9" /><path d="M10 19v-5h4v5" /></Svg>);
export const PinIcon = (p: P) => (<Svg {...p}><path d="M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10Z" /><circle cx="12" cy="11" r="2.2" /></Svg>);
export const PlanIcon = (p: P) => (<Svg {...p}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h6" /></Svg>);
export const SearchIcon = (p: P) => (<Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></Svg>);
export const ArrowIcon = (p: P) => (<Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>);
export const BackIcon = (p: P) => (<Svg {...p}><path d="M15 5l-7 7 7 7" /></Svg>);
export const CloseIcon = (p: P) => (<Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>);
export const UpIcon = (p: P) => (<Svg {...p}><path d="m6 14 6-6 6 6" /></Svg>);
export const DownIcon = (p: P) => (<Svg {...p}><path d="m6 10 6 6 6-6" /></Svg>);
export const PlusIcon = (p: P) => (<Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>);
export const TrashIcon = (p: P) => (<Svg {...p}><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" /></Svg>);
export const RefreshIcon = (p: P) => (<Svg {...p}><path d="M20 11a8 8 0 0 0-14.3-4.5L4 8" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.3 4.5L20 16" /><path d="M20 20v-4h-4" /></Svg>);
export const LocateIcon = (p: P) => (<Svg {...p}><circle cx="12" cy="12" r="3.5" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /></Svg>);
export const RouteIcon = (p: P) => (<Svg {...p}><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7" strokeDasharray="2 2.5" /></Svg>);
export const ClockIcon = (p: P) => (<Svg {...p}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></Svg>);
export const PhoneIcon = (p: P) => (<Svg {...p}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z" /></Svg>);
export const GlobeIcon = (p: P) => (<Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5Z" /></Svg>);
export const ExternalIcon = (p: P) => (<Svg {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></Svg>);
export const PlaneIcon = (p: P) => (<Svg {...p}><path d="M10.5 13.5 4 11l1-2 7 1 4-5a1.5 1.5 0 0 1 2 2l-5 4 1 7-2 1-2.5-6.5L7 15v3l-1.5 1L5 15.5 2 14l1-1.5Z" /></Svg>);
export const TrainIcon = (p: P) => (<Svg {...p}><rect x="6" y="3" width="12" height="14" rx="3" /><path d="M6 11h12M9 20l-1.5 1.5M15 20l1.5 1.5" /><circle cx="9" cy="14" r=".6" fill="currentColor" /><circle cx="15" cy="14" r=".6" fill="currentColor" /></Svg>);
export const BusIcon = (p: P) => (<Svg {...p}><rect x="5" y="3" width="14" height="15" rx="2.5" /><path d="M5 11h14M8 18v2.5M16 18v2.5" /><circle cx="8.5" cy="14.5" r=".6" fill="currentColor" /><circle cx="15.5" cy="14.5" r=".6" fill="currentColor" /></Svg>);
export const SunIcon = (p: P) => (<Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Svg>);
export const RainIcon = (p: P) => (<Svg {...p}><path d="M7 15a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 8a3.5 3.5 0 0 1 0 7Z" /><path d="M9 18l-1 2M13 18l-1 2M17 18l-1 2" /></Svg>);
export const BikeIcon = (p: P) => (<Svg {...p}><circle cx="6" cy="16" r="3.5" /><circle cx="18" cy="16" r="3.5" /><path d="M6 16l4-7h5l3 7M10 9 8.5 6H7M15 9l-3 7" /></Svg>);
export const MoonIcon = (p: P) => (<Svg {...p}><path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z" /></Svg>);
export const ShieldIcon = (p: P) => (<Svg {...p}><path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6Z" /><path d="M12 9v4M12 16h.01" /></Svg>);
export const ShareIcon = (p: P) => (<Svg {...p}><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6" /></Svg>);
export const MountainIcon = (p: P) => (<Svg {...p}><path d="M3 19 9.5 8l3.5 6 2-3 6 8Z" /></Svg>);
