"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./supabase/client";
import { MEDIA_BUCKET } from "./supabase/config";
import { SAMPLE_PROJECTS, SAMPLE_MEDIA, mediaUrl, freshSlide, freshText } from "./samples";
import type { MediaItem, Project, Slide } from "./types";

/**
 * Data layer for the Studio.
 * When Supabase env is configured, reads/writes the `projects` table and `media` bucket,
 * using an anonymous session (no login screen yet — see roadmap).
 * Otherwise it degrades gracefully to bundled sample data so the app runs during setup.
 */

// in-memory session store used only in demo (no-Supabase) mode
let demoProjects: Project[] | null = null;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ensure there is a session; sign in anonymously if needed. */
async function ensureSession(supabase: SupabaseClient): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    await supabase.auth.signInAnonymously();
  }
}

// backfill defaults + migrate legacy title/sub slides into the text-layer model
function normalizeSlide(raw: unknown): Slide {
  const s = (raw ?? {}) as Record<string, unknown>;
  const base = freshSlide((s.mediaId as string) ?? null);

  // migrate legacy { title, sub, ... } → texts[]
  let texts = s.texts as Slide["texts"] | undefined;
  if (!Array.isArray(texts)) {
    const legacy: Slide["texts"] = [];
    const oldPos = (s.pos as { text?: { x: number; y: number } } | undefined)?.text;
    const size = (s.titleSize as number) ?? 38;
    const color = (s.color as string) ?? "#FFFFFF";
    const align = (s.align as Slide["texts"][number]["align"]) ?? "left";
    if (s.title && (s.showTitle ?? true)) {
      legacy.push(
        freshText({
          content: s.title as string,
          font: (s.font as string) ?? "playfair",
          size,
          color,
          align,
          pos: oldPos ?? { x: 8, y: 54 },
        }),
      );
    }
    if (s.sub && (s.showSub ?? true)) {
      legacy.push(
        freshText({
          content: s.sub as string,
          font: "archivo",
          size: Math.max(13, size * 0.42),
          color,
          align,
          pos: { x: oldPos?.x ?? 8, y: (oldPos?.y ?? 54) + 14 },
        }),
      );
    }
    texts = legacy.length ? legacy : base.texts;
  }

  const ctaPos =
    (s.ctaPos as Slide["ctaPos"]) ??
    (s.pos as { cta?: { x: number; y: number } } | undefined)?.cta ??
    base.ctaPos;

  return {
    id: (s.id as string) ?? base.id,
    mediaId: (s.mediaId as string) ?? null,
    texts,
    cta: (s.cta as boolean) ?? base.cta,
    ctaText: (s.ctaText as string) ?? base.ctaText,
    ctaStyle: (s.ctaStyle as Slide["ctaStyle"]) ?? base.ctaStyle,
    ctaPos,
    scrim: (s.scrim as number) ?? base.scrim,
    zoom: (s.zoom as number) ?? base.zoom,
    focus: (s.focus as Slide["focus"]) ?? base.focus,
  };
}

function rowToProject(row: Record<string, unknown>): Project {
  const data = (row.data as Partial<Project>) ?? {};
  return {
    id: String(row.id),
    name: String(row.name ?? "Bez naziva"),
    format: (row.format as Project["format"]) ?? "post",
    coverMediaId: (row.cover_media_id as string) ?? null,
    slides: (data.slides ?? []).map(normalizeSlide),
    chrome: data.chrome ?? true,
    transition: data.transition ?? "fade",
    textAnim: data.textAnim ?? "rise",
    caption: data.caption,
    safe: data.safe,
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

function projectPayload(p: Project) {
  return {
    name: p.name,
    format: p.format,
    cover_media_id: p.coverMediaId,
    data: { slides: p.slides, chrome: p.chrome, transition: p.transition, textAnim: p.textAnim, caption: p.caption, safe: p.safe },
    updated_at: new Date().toISOString(),
  };
}

export async function fetchProjects(): Promise<Project[]> {
  const supabase = createClient();
  if (!supabase) {
    if (!demoProjects) demoProjects = [...SAMPLE_PROJECTS];
    return demoProjects;
  }
  await ensureSession(supabase);
  let { data } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });

  // First run for this user: seed the sample projects so the studio isn't empty.
  if (!data || data.length === 0) {
    const seeded = await seedSamples(supabase);
    if (seeded) {
      ({ data } = await supabase
        .from("projects")
        .select("*")
        .order("updated_at", { ascending: false }));
    }
  }
  return (data ?? []).map(rowToProject);
}

async function seedSamples(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? "anon";
    const key = `ruzini_seeded_${uid}`;
    if (typeof window !== "undefined" && window.localStorage.getItem(key)) return false;
    const rows = SAMPLE_PROJECTS.map((p) => projectPayload(p));
    const { error } = await supabase.from("projects").insert(rows);
    if (error) return false;
    if (typeof window !== "undefined") window.localStorage.setItem(key, "1");
    return true;
  } catch {
    return false;
  }
}

export async function persistProject(
  p: Project,
): Promise<{ ok: boolean; demo: boolean; id?: string }> {
  const supabase = createClient();
  if (!supabase) {
    if (!demoProjects) demoProjects = [...SAMPLE_PROJECTS];
    const i = demoProjects.findIndex((x) => x.id === p.id);
    if (i >= 0) demoProjects[i] = p;
    else demoProjects.unshift(p);
    return { ok: true, demo: true };
  }
  await ensureSession(supabase);
  if (UUID_RE.test(p.id)) {
    const { error } = await supabase.from("projects").update(projectPayload(p)).eq("id", p.id);
    return { ok: !error, demo: false, id: p.id };
  }
  // new project — let the DB generate the uuid
  const { data, error } = await supabase
    .from("projects")
    .insert(projectPayload(p))
    .select("id")
    .single();
  return { ok: !error, demo: false, id: data?.id as string | undefined };
}

export async function deleteProject(id: string): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) {
    if (demoProjects) demoProjects = demoProjects.filter((x) => x.id !== id);
    return true;
  }
  await ensureSession(supabase);
  const { error } = await supabase.from("projects").delete().eq("id", id);
  return !error;
}

export async function fetchMedia(): Promise<MediaItem[]> {
  const supabase = createClient();
  if (!supabase) return SAMPLE_MEDIA;
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).list("", {
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error || !data) return SAMPLE_MEDIA;
  const uploaded: MediaItem[] = data
    .filter((f) => f.id)
    .map((f) => {
      const { data: pub } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(f.name);
      const isVideo = /\.(mp4|mov|webm)$/i.test(f.name);
      // id === public URL so it resolves on the canvas directly
      return { id: pub.publicUrl, name: f.name, url: pub.publicUrl, kind: isVideo ? "video" : "image" };
    });
  return [...uploaded, ...SAMPLE_MEDIA];
}

export async function uploadMedia(file: File): Promise<MediaItem | null> {
  const supabase = createClient();
  if (!supabase) return null; // demo mode: uploads disabled
  await ensureSession(supabase);
  const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file);
  if (error) return null;
  const { data: pub } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return {
    id: pub.publicUrl,
    name: file.name,
    url: pub.publicUrl,
    kind: file.type.startsWith("video") ? "video" : "image",
  };
}

export { mediaUrl };
