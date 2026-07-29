export type Format = "post" | "story" | "reels" | "carousel";
export type CtaStyle = "cta-fill" | "cta-solid" | "cta-outline";
export type Align = "left" | "center" | "right";

export interface Pos {
  x: number;
  y: number;
}

export interface Slide {
  id: string;
  mediaId: string | null; // sample id or media URL
  title: string;
  sub: string;
  titleSize: number;
  align: Align;
  color: string;
  cta: boolean;
  ctaText: string;
  ctaStyle: CtaStyle;
  scrim: number;
  zoom: number; // 1..3 — uvećanje slike
  focus: Pos; // 0..100 — kadriranje (object-position)
  pos: { text: Pos; cta: Pos };
}

export type Transition = "none" | "fade" | "slide";
export type TextAnim = "none" | "fade" | "rise";

export interface Project {
  id: string;
  name: string;
  format: Format;
  coverMediaId: string | null;
  slides: Slide[];
  chrome: boolean;
  transition: Transition; // prelaz između slajdova (u pregledu)
  textAnim: TextAnim; // animacija teksta (u pregledu)
  updatedAt: string; // ISO
}

export interface MediaItem {
  id: string;
  name: string;
  url: string;
  kind: "image" | "video";
}

export const TEXT_COLORS = [
  "#FFFFFF",
  "#F5EDE0",
  "#C9A96E",
  "#C4B1D9",
  "#4A3566",
  "#2A2033",
];

export interface FormatMeta {
  label: string;
  short: string;
  ratio: string;
  story: boolean; // prikaži Instagram story okvir (trake + nalog)
  multi: boolean; // dozvoli više slajdova/strana
  w: number; // preporučena širina (px)
  h: number; // preporučena visina (px)
  slideLabel: string;
  platform: string;
}

export const FORMAT_META: Record<Format, FormatMeta> = {
  post: { label: "Objava · 4:5", short: "Objava", ratio: "4 / 5", story: false, multi: false, w: 1080, h: 1350, slideLabel: "Strana", platform: "Instagram" },
  story: { label: "Story · 9:16", short: "Story", ratio: "9 / 16", story: true, multi: true, w: 1080, h: 1920, slideLabel: "Strana", platform: "IG + TikTok" },
  reels: { label: "Reels · 9:16", short: "Reels", ratio: "9 / 16", story: false, multi: true, w: 1080, h: 1920, slideLabel: "Klip", platform: "IG + TikTok" },
  carousel: { label: "Carousel · 4:5", short: "Carousel", ratio: "4 / 5", story: false, multi: true, w: 1080, h: 1350, slideLabel: "Slajd", platform: "IG + TikTok" },
};
