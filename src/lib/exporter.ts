"use client";

import JSZip from "jszip";
import { fontCss } from "./types";
import type { Project, Slide } from "./types";

/**
 * Izvoz objava — sve se crta DIREKTNO na <canvas> (bez html-to-image),
 * jer je to jedini pouzdan način na iOS Safariju. Slika → PNG, video → MP4/WebM
 * sa uklopljenim tekstom/CTA. Mešoviti carousel/story → numerisan .zip.
 */

// ---------------- osnovno ----------------

export function isVideoUrl(url: string | null | undefined): boolean {
  return !!url && /\.(mp4|mov|webm|m4v)(\?|#|$)/i.test(url);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 6000);
}

const TRANSLIT: Record<string, string> = {
  č: "c", ć: "c", š: "s", ž: "z", đ: "dj",
  Č: "C", Ć: "C", Š: "S", Ž: "Z", Đ: "Dj",
};

export function safeFileName(name: string): string {
  const ascii = (name || "objava")
    .replace(/[čćšžđČĆŠŽĐ]/g, (m) => TRANSLIT[m] ?? m)
    .replace(/[^\x20-\x7E]/g, " ");
  const clean = ascii
    .trim()
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return clean || "objava";
}

/** (potencijalno cross-origin) URL → lokalni blob URL (bez CORS/keš-taint problema). */
export async function toCaptureUrl(url: string | null): Promise<string | null> {
  if (!url) return url;
  if (url.startsWith("/") || url.startsWith("blob:") || url.startsWith("data:")) return url;
  try {
    const r = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`, { cache: "reload" });
    if (r.ok) return URL.createObjectURL(await r.blob());
  } catch {
    /* fallback */
  }
  try {
    const r = await fetch(url, { mode: "cors", cache: "reload" });
    if (r.ok) return URL.createObjectURL(await r.blob());
  } catch {
    /* ignore */
  }
  return url;
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("img-load"));
    img.src = url;
  });
}

function loadVideo(url: string, muted: boolean): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.src = url;
    v.crossOrigin = "anonymous";
    v.muted = muted;
    v.defaultMuted = muted;
    v.playsInline = true;
    v.preload = "auto";
    v.onloadeddata = () => resolve(v);
    v.onerror = () => reject(new Error("video-load"));
  });
}

// ---------------- crtanje ----------------

type Media = HTMLImageElement | HTMLVideoElement;

function drawMediaCover(
  ctx: CanvasRenderingContext2D,
  src: Media,
  W: number,
  H: number,
  zoom = 1,
  focus: { x: number; y: number } = { x: 50, y: 50 },
  offX = 0,
) {
  const el = src as HTMLVideoElement & HTMLImageElement;
  const sw = el.videoWidth || el.naturalWidth || W;
  const sh = el.videoHeight || el.naturalHeight || H;
  if (!sw || !sh) return;
  const sr = sw / sh;
  const cr = W / H;
  let dw: number;
  let dh: number;
  if (sr > cr) {
    dh = H;
    dw = H * sr;
  } else {
    dw = W;
    dh = W / sr;
  }
  const px = focus.x / 100;
  const py = focus.y / 100;
  let dx = (W - dw) * px;
  let dy = (H - dh) * py;
  const ox = W * px;
  const oy = H * py;
  dx = ox + (dx - ox) * zoom + offX;
  dy = oy + (dy - oy) * zoom;
  dw *= zoom;
  dh *= zoom;
  ctx.drawImage(src, dx, dy, dw, dh);
}

const famCache = new Map<string, string>();
function resolveFamily(css: string): string {
  const hit = famCache.get(css);
  if (hit) return hit;
  let fam = css;
  try {
    const el = document.createElement("span");
    el.style.position = "absolute";
    el.style.visibility = "hidden";
    el.style.fontFamily = css;
    document.body.appendChild(el);
    fam = getComputedStyle(el).fontFamily || css;
    el.remove();
  } catch {
    /* keep css */
  }
  famCache.set(css, fam);
  return fam;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of (text || "").split("\n")) {
    const words = para.split(" ");
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        out.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    out.push(line);
  }
  return out;
}

function drawTextLayer(ctx: CanvasRenderingContext2D, t: Slide["texts"][number], W: number, H: number, scale: number) {
  const fs = Math.max(6, t.size * scale);
  ctx.font = `${t.bold ? 700 : 500} ${fs}px ${resolveFamily(fontCss(t.font))}`;
  try {
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${0.2 * scale}px`;
  } catch {
    /* ignore */
  }
  const maxW = 0.82 * W;
  const lines = wrapLines(ctx, t.content, maxW);
  const lineH = fs * 1.16;
  const widths = lines.map((l) => ctx.measureText(l).width);
  const blockW = Math.min(maxW, Math.max(1, ...widths));
  const ax = (t.pos.x / 100) * W;
  const ay = (t.pos.y / 100) * H;
  ctx.textBaseline = "top";
  ctx.fillStyle = t.color;
  ctx.shadowColor = "rgba(42,32,51,0.5)";
  ctx.shadowBlur = 16 * scale;
  ctx.shadowOffsetY = 2 * scale;
  lines.forEach((ln, i) => {
    const lw = widths[i];
    let lx = ax;
    if (t.align === "center") lx = ax + (blockW - lw) / 2;
    else if (t.align === "right") lx = ax + (blockW - lw);
    ctx.fillText(ln, lx, ay + (lineH - fs) / 2 + i * lineH);
  });
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  try {
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "0px";
  } catch {
    /* ignore */
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawCta(ctx: CanvasRenderingContext2D, slide: Slide, W: number, H: number, scale: number) {
  const fs = 15 * scale;
  const padX = 22 * scale;
  const padY = 12 * scale;
  const gap = 8 * scale;
  const arrowW = fs * 0.85;
  const ctaFamily = resolveFamily(fontCss(slide.ctaFont ?? "archivo"));
  ctx.font = `700 ${fs}px ${ctaFamily}`;
  const text = slide.ctaText || "Naruči";
  const tw = ctx.measureText(text).width;
  const ghost = slide.ctaStyle === "cta-ghost";
  const w = padX * 2 + tw + gap + arrowW;
  const h = fs + padY * 2;
  const x = (slide.ctaPos.x / 100) * W;
  const y = (slide.ctaPos.y / 100) * H;

  let bg = "#B58A3C";
  let fg = "#52295F";
  let border: string | null = null;
  if (slide.ctaStyle === "cta-solid") {
    bg = "#63347A";
    fg = "#ffffff";
  } else if (slide.ctaStyle === "cta-outline") {
    bg = "rgba(255,255,255,0.14)";
    fg = "#ffffff";
    border = "#ffffff";
  } else if (ghost) {
    fg = "#ffffff";
  }

  if (ghost) {
    // bez pozadine i obrisa — samo tekst sa senkom radi čitljivosti
    ctx.save();
    ctx.fillStyle = fg;
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 8 * scale;
    ctx.shadowOffsetY = 1 * scale;
    const gx = x + padX * 0.2;
    ctx.fillText(text, gx, y + h / 2 + 1 * scale);
    const gaxx = gx + tw + gap;
    const gcy = y + h / 2;
    ctx.strokeStyle = fg;
    ctx.lineWidth = Math.max(1.5, 2 * scale);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(gaxx, gcy);
    ctx.lineTo(gaxx + arrowW, gcy);
    ctx.moveTo(gaxx + arrowW - fs * 0.28, gcy - fs * 0.26);
    ctx.lineTo(gaxx + arrowW, gcy);
    ctx.lineTo(gaxx + arrowW - fs * 0.28, gcy + fs * 0.26);
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 22 * scale;
  ctx.shadowOffsetY = 8 * scale;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.restore();
  if (border) {
    roundRect(ctx, x + 0.8 * scale, y + 0.8 * scale, w - 1.6 * scale, h - 1.6 * scale, h / 2);
    ctx.lineWidth = 1.6 * scale;
    ctx.strokeStyle = border;
    ctx.stroke();
  }

  ctx.fillStyle = fg;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + padX, y + h / 2 + 1 * scale);
  // strelica →
  const axx = x + padX + tw + gap;
  const cy = y + h / 2;
  ctx.strokeStyle = fg;
  ctx.lineWidth = Math.max(1.5, 2 * scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(axx, cy);
  ctx.lineTo(axx + arrowW, cy);
  ctx.moveTo(axx + arrowW - fs * 0.28, cy - fs * 0.26);
  ctx.lineTo(axx + arrowW, cy);
  ctx.lineTo(axx + arrowW - fs * 0.28, cy + fs * 0.26);
  ctx.stroke();
}

/** Nacrtaj ceo slajd (pozadina + zatamnjenje + tekstovi + CTA) na dati ctx. */
function drawSlideArt(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  media: Media | null,
  W: number,
  H: number,
  scale: number,
) {
  if (media) {
    drawMediaCover(ctx, media, W, H, slide.zoom, slide.focus);
  } else {
    ctx.fillStyle = "#F1E9F4";
    ctx.fillRect(0, 0, W, H);
  }
  if (slide.scrim > 0) {
    const a = slide.scrim / 100;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgba(42,32,51,${0.28 * a})`);
    g.addColorStop(0.32, "rgba(42,32,51,0)");
    g.addColorStop(0.6, "rgba(42,32,51,0)");
    g.addColorStop(1, `rgba(42,32,51,${0.42 * a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  for (const t of slide.texts) drawTextLayer(ctx, t, W, H, scale);
  if (slide.cta) drawCta(ctx, slide, W, H, scale);
}

// ---------------- slika → PNG ----------------

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob-null"))), "image/png");
  });
}

export async function renderSlidePng(slide: Slide, media: Media | null, W: number, H: number, scale: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no-2d");
  drawSlideArt(ctx, slide, media, W, H, scale);
  return canvasToBlob(canvas);
}

// ---------------- ZIP ----------------

export async function zipMixed(items: { name: string; blob: Blob }[]): Promise<Blob> {
  const zip = new JSZip();
  items.forEach((it) => zip.file(it.name, it.blob));
  return zip.generateAsync({ type: "blob" });
}

// ---------------- video kodek ----------------

function pickMime(): { mime: string; ext: "mp4" | "webm" } | null {
  const MR = (globalThis as unknown as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder;
  if (!MR || typeof MR.isTypeSupported !== "function") return null;
  const cands: { mime: string; ext: "mp4" | "webm" }[] = [
    { mime: "video/mp4;codecs=avc1.640029", ext: "mp4" },
    { mime: "video/mp4;codecs=h264", ext: "mp4" },
    { mime: "video/mp4", ext: "mp4" },
    { mime: "video/webm;codecs=vp9", ext: "webm" },
    { mime: "video/webm;codecs=vp8", ext: "webm" },
    { mime: "video/webm", ext: "webm" },
  ];
  for (const c of cands) {
    try {
      if (MR.isTypeSupported(c.mime)) return c;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function videoSupported(): boolean {
  const c = document.createElement("canvas");
  return typeof (c as HTMLCanvasElement & { captureStream?: unknown }).captureStream === "function" && !!pickMime();
}

function makeRecorder(canvas: HTMLCanvasElement, extraTracks: MediaStreamTrack[], mime: string) {
  const capFn = (canvas as HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream }).captureStream;
  const vstream = capFn.call(canvas, 30);
  const stream = new MediaStream([...vstream.getVideoTracks(), ...extraTracks]);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  const finished = new Promise<Blob>((resolve) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: mime }));
  });
  return { rec, finished };
}

async function tryVideoAudioTracks(video: HTMLVideoElement): Promise<MediaStreamTrack[]> {
  try {
    const cap =
      (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream ||
      (video as HTMLVideoElement & { mozCaptureStream?: () => MediaStream }).mozCaptureStream;
    if (!cap) return [];
    const s = cap.call(video) as MediaStream;
    return s.getAudioTracks();
  } catch {
    return [];
  }
}

// ---------------- video slajd → MP4 ----------------

export async function exportSlideVideo(opts: {
  slide: Slide;
  url: string;
  W: number;
  H: number;
  scale: number;
  capSec?: number;
  onProgress?: (p: number) => void;
}): Promise<{ blob: Blob; ext: string }> {
  const { slide, url, W, H, scale, capSec = 60, onProgress } = opts;
  const pick = pickMime();
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx || !pick || !videoSupported()) throw new Error("video-unsupported");

  let video: HTMLVideoElement;
  let audioTracks: MediaStreamTrack[] = [];
  try {
    video = await loadVideo(url, false);
    video.currentTime = 0;
    await video.play();
    audioTracks = await tryVideoAudioTracks(video);
    video.pause();
    video.currentTime = 0;
  } catch {
    video = await loadVideo(url, true);
    audioTracks = [];
  }

  const { rec, finished } = makeRecorder(canvas, audioTracks, pick.mime);
  const dur = Math.min(capSec, video.duration || capSec);

  drawSlideArt(ctx, slide, video, W, H, scale);
  await video.play().catch(() => {});
  rec.start(250);
  const t0 = performance.now();
  await new Promise<void>((resolve) => {
    const frame = () => {
      const el = (performance.now() - t0) / 1000;
      if (el >= dur || video.ended) {
        resolve();
        return;
      }
      drawSlideArt(ctx, slide, video, W, H, scale);
      onProgress?.(el / dur);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  video.pause();
  await new Promise((r) => setTimeout(r, 150));
  try {
    rec.requestData();
  } catch {
    /* ignore */
  }
  await new Promise((r) => setTimeout(r, 60));
  rec.stop();
  const blob = await finished;
  if (blob.size < 1000) throw new Error("video-empty");
  return { blob, ext: pick.ext };
}

// ---------------- Reels montaža ----------------

export interface ReelsItem {
  slide: Slide;
  kind: "image" | "video";
  imgEl?: HTMLImageElement | null; // za sliku
  url?: string; // za video
}

export async function exportReelsMontage(
  items: ReelsItem[],
  W: number,
  H: number,
  scale: number,
  transition: "none" | "fade" | "slide",
  onProgress?: (p: number) => void,
): Promise<{ blob: Blob; ext: string }> {
  const pick = pickMime();
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx || !pick || !videoSupported()) throw new Error("video-unsupported");

  const STILL_MS = 2400;
  const TRANS = 500;
  const CAP = 20;

  type Prep =
    | { kind: "image"; el: HTMLImageElement | null; slide: Slide; ms: number }
    | { kind: "video"; video: HTMLVideoElement; slide: Slide; dur: number };
  const prepared: Prep[] = [];
  for (const it of items) {
    if (it.kind === "video" && it.url) {
      const video = await loadVideo(it.url, true);
      prepared.push({ kind: "video", video, slide: it.slide, dur: Math.min(CAP, video.duration || 4) });
    } else {
      prepared.push({ kind: "image", el: it.imgEl ?? null, slide: it.slide, ms: STILL_MS });
    }
  }
  if (prepared.length === 0) throw new Error("no-segments");

  const totalMs = prepared.reduce((a, p) => a + (p.kind === "image" ? p.ms : p.dur * 1000), 0);
  const { rec, finished } = makeRecorder(canvas, [], pick.mime);

  // pomoćni offscreen za crtanje statične slike-slajda (radi prelaza)
  function renderStill(p: { el: HTMLImageElement | null; slide: Slide }): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const cx = c.getContext("2d")!;
    drawSlideArt(cx, p.slide, p.el, W, H, scale);
    return c;
  }

  rec.start(250);
  let elapsedBefore = 0;
  let prevStill: HTMLCanvasElement | null = null;

  for (const p of prepared) {
    if (p.kind === "image") {
      const still = renderStill(p);
      const from = prevStill;
      await new Promise<void>((resolve) => {
        const t0 = performance.now();
        const step = () => {
          const el = performance.now() - t0;
          if (el >= p.ms) {
            resolve();
            return;
          }
          if (from && transition !== "none" && el < TRANS) {
            const pr = el / TRANS;
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, W, H);
            if (transition === "slide") {
              ctx.drawImage(from, -W * pr, 0);
              ctx.drawImage(still, W - W * pr, 0);
            } else {
              ctx.drawImage(from, 0, 0);
              ctx.globalAlpha = pr;
              ctx.drawImage(still, 0, 0);
              ctx.globalAlpha = 1;
            }
          } else {
            ctx.drawImage(still, 0, 0);
          }
          onProgress?.((elapsedBefore + el) / totalMs);
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      prevStill = still;
      elapsedBefore += p.ms;
    } else {
      p.video.currentTime = 0;
      await p.video.play().catch(() => {});
      await new Promise<void>((resolve) => {
        const t0 = performance.now();
        const step = () => {
          const el = (performance.now() - t0) / 1000;
          if (el >= p.dur || p.video.ended) {
            resolve();
            return;
          }
          drawSlideArt(ctx, p.slide, p.video, W, H, scale);
          onProgress?.((elapsedBefore + el * 1000) / totalMs);
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      p.video.pause();
      prevStill = null;
      elapsedBefore += p.dur * 1000;
    }
  }

  await new Promise((r) => setTimeout(r, 150));
  try {
    rec.requestData();
  } catch {
    /* ignore */
  }
  await new Promise((r) => setTimeout(r, 60));
  rec.stop();
  const blob = await finished;
  if (blob.size < 1000) throw new Error("video-empty");
  return { blob, ext: pick.ext };
}

// zadržano zbog kompatibilnosti tipa u pozivaocu (project se ne koristi ovde)
export type { Project };
