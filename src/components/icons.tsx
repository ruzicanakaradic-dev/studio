import type { SVGProps } from "react";

const s = (props: SVGProps<SVGSVGElement>) => ({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

export const Plus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} strokeWidth={2.4}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const Export = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} strokeWidth={2.2}>
    <path d="M12 15V3" />
    <path d="m7 8 5-5 5 5" />
    <path d="M5 21h14" />
  </svg>
);
export const Undo = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h11a5 5 0 0 1 0 10h-1" />
  </svg>
);
export const Redo = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H9a5 5 0 0 0 0 10h1" />
  </svg>
);
export const Back = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <path d="m15 18-6-6 6-6" />
  </svg>
);
export const Close = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
export const Check = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} strokeWidth={2.4}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
export const Arrow = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)} strokeWidth={2.4}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const Info = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </svg>
);
export const Grid = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);
export const Eye = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
export const Brand = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <circle cx="13.5" cy="6.5" r="2.5" />
    <circle cx="17.5" cy="12.5" r="2.5" />
    <circle cx="8.5" cy="7.5" r="2.5" />
    <circle cx="6.5" cy="13.5" r="2.5" />
    <path d="M12 22a3 3 0 0 1 0-6" />
  </svg>
);
export const Layers = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <path d="m12 2 9 5-9 5-9-5 9-5Z" />
    <path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
  </svg>
);
export const TextIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <path d="M4 7V5h16v2M9 20h6M12 5v15" />
  </svg>
);
export const CtaIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <rect x="3" y="8" width="18" height="8" rx="4" />
    <path d="M7 12h.01" />
  </svg>
);
export const ImgIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-5-5L5 21" />
  </svg>
);
export const Upload = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <path d="M12 15V3M7 8l5-5 5 5" />
    <path d="M20 17v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2" />
  </svg>
);
export const Sparkle = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3Z" />
    <path d="M19 14l.8 2 .2.2 2 .8-2 .8-.2.2-.8 2-.8-2-.2-.2-2-.8 2-.8.2-.2.8-2Z" />
  </svg>
);
export const Copy = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
export const Trash = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);
export const Play = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M8 5v14l11-7z" />
  </svg>
);
export const AlignLeft = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <path d="M3 6h18M3 12h12M3 18h15" />
  </svg>
);
export const AlignCenter = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <path d="M3 6h18M6 12h12M4 18h16" />
  </svg>
);
export const AlignRight = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <path d="M3 6h18M9 12h12M6 18h15" />
  </svg>
);

// format glyphs
export const FmtPost = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
  </svg>
);
export const FmtStory = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <rect x="6" y="2" width="12" height="20" rx="2" />
    <path d="M9 6h6" />
  </svg>
);
export const FmtReels = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="m10 8 5 4-5 4V8Z" fill="currentColor" />
  </svg>
);
export const FmtCarousel = (p: SVGProps<SVGSVGElement>) => (
  <svg {...s(p)}>
    <rect x="7" y="4" width="14" height="16" rx="2" />
    <path d="M4 7v11a2 2 0 0 0 2 2h11" opacity=".5" />
  </svg>
);
