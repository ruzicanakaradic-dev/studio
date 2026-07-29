"use client";

import { createClient } from "./supabase/client";
import { MEDIA_BUCKET } from "./supabase/config";
import { SAMPLE_PROJECTS, SAMPLE_MEDIA, mediaUrl } from "./samples";
import type { MediaItem, Project } from "./types";

/**
 * Data layer for the Studio.
 * When Supabase env is configured, reads/writes the `projects` table and `media` bucket.
 * Otherwise it degrades gracefully to bundled sample data so the app runs during setup.
 */

// in-memory session store used only in demo (no-Supabase) mode
let demoProjects: Project[] | null = null;

function rowToProject(row: Record<string, unknown>): Project {
  const data = (row.data as Partial<Project>) ?? {};
  return {
    id: String(row.id),
    name: String(row.name ?? "Bez naziva"),
    format: (row.format as Project["format"]) ?? "post",
    coverMediaId: (row.cover_media_id as string) ?? null,
    slides: data.slides ?? [],
    chrome: data.chrome ?? true,
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

function projectToRow(p: Project) {
  return {
    id: p.id,
    name: p.name,
    format: p.format,
    cover_media_id: p.coverMediaId,
    data: { slides: p.slides, chrome: p.chrome },
    updated_at: new Date().toISOString(),
  };
}

export async function fetchProjects(): Promise<Project[]> {
  const supabase = createClient();
  if (!supabase) {
    if (!demoProjects) demoProjects = [...SAMPLE_PROJECTS];
    return demoProjects;
  }
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error || !data) return [...SAMPLE_PROJECTS];
  return data.map(rowToProject);
}

export async function persistProject(p: Project): Promise<{ ok: boolean; demo: boolean }> {
  const supabase = createClient();
  if (!supabase) {
    if (!demoProjects) demoProjects = [...SAMPLE_PROJECTS];
    const i = demoProjects.findIndex((x) => x.id === p.id);
    if (i >= 0) demoProjects[i] = p;
    else demoProjects.unshift(p);
    return { ok: true, demo: true };
  }
  const { error } = await supabase.from("projects").upsert(projectToRow(p));
  return { ok: !error, demo: false };
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
      return { id: f.name, name: f.name, url: pub.publicUrl, kind: isVideo ? "video" : "image" };
    });
  return [...uploaded, ...SAMPLE_MEDIA];
}

export async function uploadMedia(file: File): Promise<MediaItem | null> {
  const supabase = createClient();
  if (!supabase) return null; // demo mode: uploads disabled
  const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file);
  if (error) return null;
  const { data: pub } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return {
    id: path,
    name: file.name,
    url: pub.publicUrl,
    kind: file.type.startsWith("video") ? "video" : "image",
  };
}

export { mediaUrl };
