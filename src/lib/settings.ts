"use client";

import { fontCss } from "./types";

export interface HashtagSet {
  name: string;
  tags: string;
}

export interface BrandProfile {
  headingFont: string;
  bodyFont: string;
  toneChips: string[];
  toneText: string;
  bannedWords: string[];
  hashtagSets: HashtagSet[];
  watermark: boolean;
}

export interface AiSettings {
  speed: "brzi" | "kvalitetniji";
  textLength: "kratko" | "srednje" | "duže";
  emoji: "bez" | "najviše 1" | "slobodno";
  permissions: {
    caption: boolean;
    hashtags: boolean;
    timing: boolean;
    backgrounds: boolean;
    learn: boolean;
  };
  autonomy: "cekaj" | "nedelja" | "samostalno";
  quotaUsed: number;
  quotaLimit: number;
}

export const DEFAULT_BRAND: BrandProfile = {
  headingFont: "playfair",
  bodyFont: "archivo",
  toneChips: ["toplo", "kratko", 'na „ti"', "bez uzvičnika", "domaćinski", "bez marketinga"],
  toneText:
    'Piši kao domaćica koja voli svoj posao. Kratko, na „ti", bez marketinga i bez uzvičnika. Potpis na kraju: „Sveže rađeno samo za Vas."',
  bannedWords: ["akcija!!!", "najbolji u gradu", "poručite već danas", "HIT"],
  hashtagSets: [
    { name: "Svakodnevno", tags: "#domaćikolači #ružinikolači #svežerađeno" },
    { name: "Torte po meri", tags: "#tortapomeri #rođendanskatorta #novisad" },
    { name: "Reels", tags: "#reels #kolači #pekara #fyp" },
  ],
  watermark: true,
};

export const DEFAULT_AI: AiSettings = {
  speed: "brzi",
  textLength: "srednje",
  emoji: "najviše 1",
  permissions: { caption: true, hashtags: true, timing: true, backgrounds: false, learn: true },
  autonomy: "cekaj",
  quotaUsed: 47,
  quotaLimit: 1500,
};

export const PALETTE = [
  { name: "Šljiva", role: "GLAVNA", hex: "#63347A" },
  { name: "Zlatna", role: "AKCENAT", hex: "#B58A3C" },
  { name: "Krem", role: "PODLOGA", hex: "#FAF3E4" },
  { name: "Ink", role: "TEKST", hex: "#2B2130" },
];

const BRAND_KEY = "ruzini_brand";
const AI_KEY = "ruzini_ai";

export function loadBrand(): BrandProfile {
  if (typeof window === "undefined") return DEFAULT_BRAND;
  try {
    const raw = localStorage.getItem(BRAND_KEY);
    return raw ? { ...DEFAULT_BRAND, ...JSON.parse(raw) } : DEFAULT_BRAND;
  } catch {
    return DEFAULT_BRAND;
  }
}
export function saveBrand(b: BrandProfile) {
  if (typeof window !== "undefined") localStorage.setItem(BRAND_KEY, JSON.stringify(b));
}
export function loadAi(): AiSettings {
  if (typeof window === "undefined") return DEFAULT_AI;
  try {
    const raw = localStorage.getItem(AI_KEY);
    return raw ? { ...DEFAULT_AI, ...JSON.parse(raw) } : DEFAULT_AI;
  } catch {
    return DEFAULT_AI;
  }
}
export function saveAi(a: AiSettings) {
  if (typeof window !== "undefined") localStorage.setItem(AI_KEY, JSON.stringify(a));
}

/** Apply brand fonts to the whole app via CSS variables. */
export function applyBrandFonts(b: BrandProfile) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--font-display", fontCss(b.headingFont));
  document.documentElement.style.setProperty("--font-body", fontCss(b.bodyFont));
}

// fonts offered for headings vs body in Brend
export const HEADING_FONTS = ["playfair", "cormorant", "lora", "fraunces", "ebgaramond", "dmserif", "marcellus"];
export const BODY_FONTS = ["archivo", "karla", "inter", "worksans", "nunito", "lora"];
