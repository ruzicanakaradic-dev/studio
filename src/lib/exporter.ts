"use client";

import { toBlob, getFontEmbedCSS } from "html-to-image";
import JSZip from "jszip";

/**
 * Izvoz gotovih objava iz Studija — SVESTAN je tipa medija po svakom slajdu.
 * Svaki slajd zna da li je slika ili video (po ekstenziji stvarnog fajla), pa se
 * i izvozi u skladu s tim: slika → PNG, video → MP4/WebM (sa uklopljenim tekstom/CTA).
 * Mešoviti carousel/story (npr. 2 videa + 5 slika) → jedan .zip sa numerisanim
 * fajlovima gde svaki ima svoju ekstenziju (naziv-1.png, naziv-2.mp4, …).
 */

// -------- pomoćne --------

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

/** Očisti naziv u bezbedno ASCII ime fajla (bez č/ć/š/ž/đ i specijalnih znakova). */
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

/**
 * Pretvori (potencijalno cross-origin) URL medija u lokalni blob URL koji se
 * može bezbedno „upeći" u izvoz. Rešava problem kada slika/video ne uđe u izvoz
 * zbog CORS/keš-taint-a (editor učita bez crossOrigin, izvoz traži sa crossOrigin).
 */
export async function toCaptureUrl(url: string | null): Promise<string | null> {
  if (!url) return url;
  if (url.startsWith("/") || url.startsWith("blob:") || url.startsWith("data:")) return url;
  // 1) same-origin proxy (server dovuče fajl — nema CORS problema)
  try {
    const r = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`, { cache: "reload" });
    if (r.ok) return URL.createObjectURL(await r.blob());
  } catch {
    /* nastavi na fallback */
  }
  // 2) direktan CORS fetch (ako proxy nije dostupan, npr. demo bez Supabase-a)
  try {
    const r = await fetch(url, { mode: "cors", cache: "reload" });
    if (r.ok) return URL.createObjectURL(await r.blob());
  } catch {
    /* ignore */
  }
  return url; // best-effort
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      resolve(img);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    };
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

/** object-fit:cover + object-position(focus) + transform:scale(zoom) — identično editoru. */
function drawMediaCover(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource & { width?: number; height?: number },
  W: number,
  H: number,
  zoom = 1,
  focus: { x: number; y: number } = { x: 50, y: 50 },
  offX = 0,
) {
  const el = src as HTMLVideoElement & HTMLImageElement;
  const sw = el.videoWidth || el.naturalWidth || (src as HTMLImageElement).width || W;
  const sh = el.videoHeight || el.naturalHeight || (src as HTMLImageElement).height || H;
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

async function fetchAsBlob(url: string): Promise<Blob> {
  const r = await fetch(url, { mode: "cors" });
  if (!r.ok) throw new Error("fetch-failed");
  return r.blob();
}

// -------- snimanje slika (PNG / overlay) --------

async function nodeToBlob(node: HTMLElement, pixelRatio: number, fontEmbedCSS?: string): Promise<Blob> {
  const opts = { pixelRatio, cacheBust: true, fontEmbedCSS, quality: 1 } as const;
  let blob = await toBlob(node, opts);
  if (!blob) blob = await toBlob(node, opts); // iOS Safari: prvi frame zna biti prazan
  if (!blob) throw new Error("capture-failed");
  return blob;
}

/** Snimi niz DOM čvorova u PNG blobove na traženoj rezoluciji (~1080px širine). */
export async function captureNodes(
  nodes: HTMLElement[],
  pixelRatio: number,
  onStep?: (done: number, total: number) => void,
): Promise<(Blob | null)[]> {
  const fontEmbedCSS = nodes[0] ? await getFontEmbedCSS(nodes[0]).catch(() => undefined) : undefined;
  if (nodes[0]) await toBlob(nodes[0], { pixelRatio: 0.3, fontEmbedCSS, cacheBust: true }).catch(() => null);
  const blobs: (Blob | null)[] = [];
  for (let i = 0; i < nodes.length; i++) {
    try {
      blobs.push(await nodeToBlob(nodes[i], pixelRatio, fontEmbedCSS));
    } catch {
      blobs.push(null); // jedan neuspeh ne ruši ceo izvoz
    }
    onStep?.(i + 1, nodes.length);
  }
  return blobs;
}

export async function zipMixed(
  items: { name: string; blob: Blob }[],
): Promise<Blob> {
  const zip = new JSZip();
  items.forEach((it) => zip.file(it.name, it.blob));
  return zip.generateAsync({ type: "blob" });
}

// -------- video kodek --------

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

/**
 * Jedan VIDEO slajd → video fajl sa uklopljenim tekstom/CTA/scrim-om.
 * Ako slajd nema nikakav overlay, prosledi se originalni fajl (najbolji kvalitet + zvuk).
 */
export async function exportVideoSlide(opts: {
  url: string;
  overlayBlob: Blob | null; // transparentni sloj (scrim+tekst+cta) ili null ako nema
  hasOverlay: boolean;
  W: number;
  H: number;
  zoom: number;
  focus: { x: number; y: number };
  capSec?: number;
  onProgress?: (p: number) => void;
}): Promise<{ blob: Blob; ext: string }> {
  const { url, overlayBlob, hasOverlay, W, H, zoom, focus, capSec = 60, onProgress } = opts;

  // bez overlaya → prosledi original (čuva zvuk i kvalitet)
  if (!hasOverlay) {
    try {
      const blob = await fetchAsBlob(url);
      const m = url.match(/\.(mp4|mov|webm|m4v)(\?|#|$)/i);
      return { blob, ext: (m?.[1] || "mp4").toLowerCase() };
    } catch {
      /* padni na re-encode ispod */
    }
  }

  const pick = pickMime();
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx || !pick || !videoSupported()) throw new Error("video-unsupported");

  const overlay = overlayBlob ? await loadImageFromBlob(overlayBlob) : null;

  // probaj sa zvukom (nemutovano); ako play() padne → mutovano (bez zvuka)
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

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  drawMediaCover(ctx, video, W, H, zoom, focus);
  if (overlay) ctx.drawImage(overlay, 0, 0, W, H);

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
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      drawMediaCover(ctx, video, W, H, zoom, focus);
      if (overlay) ctx.drawImage(overlay, 0, 0, W, H);
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

// -------- Reels: montaža (slike + video, spojeno u jedan klip) --------

export interface ReelsSegment {
  kind: "still" | "video";
  imgBlob?: Blob; // still: gotov PNG (bg+overlay); video: transparentni overlay
  url?: string; // video: izvor
  zoom?: number;
  focus?: { x: number; y: number };
}

export async function exportReelsMontage(
  segments: ReelsSegment[],
  transition: "none" | "fade" | "slide",
  onProgress?: (p: number) => void,
): Promise<{ blob: Blob; ext: string }> {
  const pick = pickMime();
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx || !pick || !videoSupported()) throw new Error("video-unsupported");

  const STILL_MS = 2400;
  const TRANS = 520;
  const CAP = 20;

  // pripremi resurse
  type Prepared =
    | { kind: "still"; img: HTMLImageElement; ms: number }
    | { kind: "video"; video: HTMLVideoElement; overlay: HTMLImageElement | null; dur: number; zoom: number; focus: { x: number; y: number } };
  const prepared: Prepared[] = [];
  for (const s of segments) {
    if (s.kind === "still" && s.imgBlob) {
      prepared.push({ kind: "still", img: await loadImageFromBlob(s.imgBlob), ms: STILL_MS });
    } else if (s.kind === "video" && s.url) {
      const video = await loadVideo(s.url, true); // montaža bez zvuka (muzika se dodaje u IG-u)
      const overlay = s.imgBlob ? await loadImageFromBlob(s.imgBlob) : null;
      prepared.push({
        kind: "video",
        video,
        overlay,
        dur: Math.min(CAP, video.duration || 4),
        zoom: s.zoom ?? 1,
        focus: s.focus ?? { x: 50, y: 50 },
      });
    }
  }
  if (prepared.length === 0) throw new Error("no-segments");

  const totalMs = prepared.reduce((a, p) => a + (p.kind === "still" ? p.ms : p.dur * 1000), 0);
  const { rec, finished } = makeRecorder(canvas, [], pick.mime);

  rec.start(250);
  let elapsedBefore = 0;
  let prevStill: HTMLImageElement | null = null;

  for (const p of prepared) {
    if (p.kind === "still") {
      const from = prevStill;
      await new Promise<void>((resolve) => {
        const t0 = performance.now();
        const frame = () => {
          const el = performance.now() - t0;
          if (el >= p.ms) {
            resolve();
            return;
          }
          if (from && transition !== "none" && el < TRANS) {
            const pr = el / TRANS;
            if (transition === "slide") {
              drawMediaCover(ctx, from, W, H, 1, { x: 50, y: 50 }, -W * pr);
              drawMediaCover(ctx, p.img, W, H, 1, { x: 50, y: 50 }, W - W * pr);
            } else {
              drawMediaCover(ctx, from, W, H);
              ctx.globalAlpha = pr;
              drawMediaCover(ctx, p.img, W, H);
              ctx.globalAlpha = 1;
            }
          } else {
            drawMediaCover(ctx, p.img, W, H);
          }
          onProgress?.((elapsedBefore + el) / totalMs);
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
      prevStill = p.img;
      elapsedBefore += p.ms;
    } else {
      p.video.currentTime = 0;
      await p.video.play().catch(() => {});
      await new Promise<void>((resolve) => {
        const t0 = performance.now();
        const frame = () => {
          const el = (performance.now() - t0) / 1000;
          if (el >= p.dur || p.video.ended) {
            resolve();
            return;
          }
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, W, H);
          drawMediaCover(ctx, p.video, W, H, p.zoom, p.focus);
          if (p.overlay) ctx.drawImage(p.overlay, 0, 0, W, H);
          onProgress?.((elapsedBefore + el * 1000) / totalMs);
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
      p.video.pause();
      prevStill = null; // tvrdi rez posle videa
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
