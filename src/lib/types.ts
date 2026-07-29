export type Format = "post" | "story" | "reels" | "carousel";
export type CtaStyle = "cta-fill" | "cta-solid" | "cta-outline";
export type Align = "left" | "center" | "right";

export interface Pos {
  x: number;
  y: number;
}

export interface TextLayer {
  id: string;
  content: string;
  font: string; // ključ iz FONTS
  size: number; // px
  color: string;
  align: Align;
  bold: boolean;
  pos: Pos; // 0..100
}

export interface Slide {
  id: string;
  mediaId: string | null; // sample id or media URL
  texts: TextLayer[]; // slobodan broj tekstualnih slojeva
  cta: boolean;
  ctaText: string;
  ctaStyle: CtaStyle;
  ctaPos: Pos;
  scrim: number;
  zoom: number; // 1..3 — uvećanje slike
  focus: Pos; // 0..100 — kadriranje (object-position)
}

export interface FontOption {
  key: string;
  label: string;
  css: string;
}

export const FONTS: FontOption[] = [
  // serif / display
  { key: "playfair", label: "Playfair Display", css: "var(--font-playfair), Georgia, serif" },
  { key: "cormorant", label: "Cormorant", css: "var(--font-cormorant), Georgia, serif" },
  { key: "lora", label: "Lora", css: "var(--font-lora), Georgia, serif" },
  { key: "fraunces", label: "Fraunces", css: "var(--font-fraunces), Georgia, serif" },
  { key: "ebgaramond", label: "EB Garamond", css: "var(--font-ebgaramond), Georgia, serif" },
  { key: "dmserif", label: "DM Serif", css: "var(--font-dmserif), Georgia, serif" },
  { key: "marcellus", label: "Marcellus", css: "var(--font-marcellus), Georgia, serif" },
  // sans
  { key: "archivo", label: "Archivo", css: "var(--font-archivo), system-ui, sans-serif" },
  { key: "karla", label: "Karla", css: "var(--font-karla), system-ui, sans-serif" },
  { key: "inter", label: "Inter", css: "var(--font-inter), system-ui, sans-serif" },
  { key: "worksans", label: "Work Sans", css: "var(--font-worksans), system-ui, sans-serif" },
  { key: "nunito", label: "Nunito", css: "var(--font-nunito), system-ui, sans-serif" },
  // rukopis
  { key: "dancing", label: "Rukopis", css: "var(--font-dancing), cursive" },
];

// mapiranje uklonjenih starih ključeva (kompatibilnost sa ranije sačuvanim projektima)
const FONT_ALIAS: Record<string, string> = {
  poppins: "archivo",
};

export function fontCss(key: string): string {
  const k = FONT_ALIAS[key] ?? key;
  return (FONTS.find((f) => f.key === k) ?? FONTS[0]).css;
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
  caption?: string; // opis objave (Instagram/TikTok) — čuva se uz nacrt
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

export interface SafeInset {
  top: number;
  bottom: number;
  left: number;
  right: number;
} // udeo (0..1) po ivici koji treba držati čistim

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
  safe: SafeInset;
}

export const FORMAT_META: Record<Format, FormatMeta> = {
  post: { label: "Objava · 4:5", short: "Objava", ratio: "4 / 5", story: false, multi: false, w: 1080, h: 1350, slideLabel: "Strana", platform: "Instagram", safe: { top: 0.05, bottom: 0.08, left: 0.05, right: 0.05 } },
  story: { label: "Story · 9:16", short: "Story", ratio: "9 / 16", story: true, multi: true, w: 1080, h: 1920, slideLabel: "Strana", platform: "IG + TikTok", safe: { top: 0.12, bottom: 0.14, left: 0.05, right: 0.06 } },
  reels: { label: "Reels · 9:16", short: "Reels", ratio: "9 / 16", story: false, multi: true, w: 1080, h: 1920, slideLabel: "Klip", platform: "IG + TikTok", safe: { top: 0.1, bottom: 0.25, left: 0.05, right: 0.13 } },
  carousel: { label: "Carousel · 4:5", short: "Carousel", ratio: "4 / 5", story: false, multi: true, w: 1080, h: 1350, slideLabel: "Slajd", platform: "IG + TikTok", safe: { top: 0.05, bottom: 0.08, left: 0.05, right: 0.05 } },
};
