import type { MediaItem, Project, Slide, Format } from "./types";

// Seed media — bundled sample assets (kolači). In production these come from Supabase Storage.
export const SAMPLE_MEDIA: MediaItem[] = [
  { id: "kolaci-1", name: "Sitni kolači", url: "/samples/kolaci-1.jpg", kind: "image" },
  { id: "kolaci-2", name: "Platna sa kolačima", url: "/samples/kolaci-2.jpg", kind: "image" },
  { id: "video-torta", name: "Torta — rotacija", url: "/samples/video-torta.jpg", kind: "video" },
  { id: "video-krem", name: "Cashew krem", url: "/samples/video-krem.jpg", kind: "video" },
  { id: "video-sastojci", name: "Sastojci", url: "/samples/video-sastojci.jpg", kind: "video" },
];

export function mediaUrl(id: string | null): string | null {
  if (!id) return null;
  const m = SAMPLE_MEDIA.find((x) => x.id === id);
  if (m) return m.url;
  // treat as storage path / absolute url
  return id.startsWith("http") || id.startsWith("/") ? id : null;
}

let counter = 0;
export function uid(prefix = "s"): string {
  counter += 1;
  return `${prefix}_${counter}_${Math.round(performance.now() * 1000) % 1_000_000}`;
}

export function freshSlide(mediaId: string | null = null): Slide {
  return {
    id: uid("slide"),
    mediaId,
    title: "Domaći sitni kolači",
    sub: "Ručno pravljeni, sa ljubavlju",
    titleSize: 38,
    align: "left",
    color: "#FFFFFF",
    cta: true,
    ctaText: "Naruči",
    ctaStyle: "cta-fill",
    scrim: 42,
    zoom: 1,
    focus: { x: 50, y: 50 },
    font: "fraunces",
    showTitle: true,
    showSub: true,
    pos: { text: { x: 8, y: 55 }, cta: { x: 8, y: 87 } },
  };
}

export function newProject(format: Format, name = "Bez naziva", mediaId: string | null = null): Project {
  return {
    id: uid("proj"),
    name,
    format,
    coverMediaId: mediaId,
    slides: [freshSlide(mediaId)],
    chrome: true,
    transition: "fade",
    textAnim: "rise",
    updatedAt: new Date().toISOString(),
  };
}

// Seed dashboard projects (shown until Supabase has data)
export const SAMPLE_PROJECTS: Project[] = [
  { ...seed("Sitni kolači — jesenja tura", "post", "kolaci-1"), updatedAt: "2026-07-29T04:00:00Z" },
  { ...seed("Torta nedelje", "reels", "video-torta"), updatedAt: "2026-07-28T10:00:00Z" },
  { ...seed("Naruči za slavu", "story", "kolaci-2"), updatedAt: "2026-07-26T10:00:00Z" },
  { ...seed("Sastojci koje volimo", "carousel", "video-sastojci"), updatedAt: "2026-07-22T10:00:00Z" },
];

function seed(name: string, format: Format, mediaId: string): Project {
  const p = newProject(format, name, mediaId);
  return p;
}
