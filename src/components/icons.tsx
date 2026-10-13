// Small inline icon set (stroke icons, inherit currentColor).
type P = { className?: string };
const base = (className = "") => ({
  className: `inline-block h-4 w-4 shrink-0 ${className}`,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const BedIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7M3 15h18M6 9V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
  </svg>
);
export const BathIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3ZM6 12V6a2 2 0 0 1 4 0M7 19l-1 2M17 19l1 2" />
  </svg>
);
export const AreaIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 4h16v16H4zM4 9h5V4M15 20v-5h5" />
  </svg>
);
export const StairsIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3 20h5v-5h5v-5h5V5h3" />
  </svg>
);
export const PinIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11Z" />
    <circle cx="12" cy="10" r="2.3" />
  </svg>
);
export const SearchIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </svg>
);
export const PhotoIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="9" cy="10" r="1.5" />
    <path d="m21 16-5-5-7 8" />
  </svg>
);
export const PhoneIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
  </svg>
);
export const WhatsAppIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 20l1.3-3.8A8 8 0 1 1 8.2 19L4 20Z" />
    <path d="M9.5 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 1a4 4 0 0 1-2-2l1-1-1-2-1.5 1Z" />
  </svg>
);
export const CheckIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="m5 12 4 4L19 7" />
  </svg>
);
export const ChevronIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);
export const CloseIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const ShareIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M10 14 20 4M20 4h-6M20 4v6M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" />
  </svg>
);
export const BuildingIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M14 9h5a1 1 0 0 1 1 1v11M4 21h17M8 8h2M8 12h2M8 16h2M17 13h1M17 17h1" />
  </svg>
);
export const DocumentIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5ZM14 3v5h5M9 13h6M9 17h6" />
  </svg>
);
export const WalletIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M18 7V5a1 1 0 0 0-1-1H6a2 2 0 0 0 0 4h13a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V6" />
    <path d="M21 12h-4a2 2 0 0 0 0 4h4v-4Z" />
  </svg>
);
export const ExchangeIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 8h15m0 0-3.5-3.5M19 8l-3.5 3.5M20 16H5m0 0 3.5-3.5M5 16l3.5 3.5" />
  </svg>
);
