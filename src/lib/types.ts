export type Format = "post" | "story" | "reels" | "carousel";
export type CtaStyle = "cta-fill" | "cta-solid" | "cta-outline";
export type Align = "left" | "center" | "right";

export interface Pos {
  x: number;
  y: number;
}

export interface Slide {
  id: string;
  mediaId: string | null; // sample id or storage path
  title: string;
  sub: string;
  titleSize: number;
  align: Align;
  color: string;
  cta: boolean;
  ctaText: string;
  ctaStyle: CtaStyle;
  scrim: number;
  pos: { text: Pos; cta: Pos };
}

export interface Project {
  id: string;
  name: string;
  format: Format;
  coverMediaId: string | null;
  slides: Slide[];
  chrome: boolean;
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

export const FORMAT_META: Record<
  Format,
  { label: string; short: string; ratio: string; story: boolean; carousel: boolean }
> = {
  post: { label: "Objava · 4:5", short: "Objava", ratio: "4 / 5", story: false, carousel: false },
  story: { label: "Story · 9:16", short: "Story", ratio: "9 / 16", story: true, carousel: false },
  reels: { label: "Reels · 9:16", short: "Reels", ratio: "9 / 16", story: true, carousel: false },
  carousel: { label: "Carousel · 4:5", short: "Carousel", ratio: "4 / 5", story: false, carousel: true },
};
