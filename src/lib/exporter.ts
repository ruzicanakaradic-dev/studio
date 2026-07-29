"use client";

import { toBlob, getFontEmbedCSS } from "html-to-image";
import JSZip from "jszip";

/**
 * Izvoz gotovih objava iz Studija.
 * - slike (Objava/Story/Carousel) → PNG na 1080px širine; više strana → numerisan .zip
 * - Reels → .mp4 (Safari/iOS MediaRecorder daje H.264 mp4) sa animiranim prelazima,
 *   uz fallback na .webm (Android/desktop Chrome).
 */

/** Bezbedno preuzimanje bloba kao fajl (radi i u iOS Safariju). */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const TRANSLIT: Record<string, string> = {
  č: "c", ć: "c", š: "s", ž: "z", đ: "dj",
  Č: "C", Ć: "C", Š: "S", Ž: "Z", Đ: "Dj",
};

/** Očisti naziv projekta u bezbedno ASCII ime fajla (bez č/ć/š/ž/đ i specijalnih znakova). */
export function safeFileName(name: string): string {
  const ascii = (name || "objava")
    .replace(/[čćšžđČĆŠŽĐ]/g, (m) => TRANSLIT[m] ?? m)
    // ukloni preostale ne-ASCII znakove (em-crta, emoji, itd.)
    .replace(/[^\x20-\x7E]/g, " ");
  const clean = ascii
    .trim()
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return clean || "objava";
}

async function nodeToBlob(node: HTMLElement, pixelRatio: number, fontEmbedCSS?: string): Promise<Blob> {
  const opts = { pixelRatio, cacheBust: true, fontEmbedCSS, quality: 1 } as const;
  let blob = await toBlob(node, opts);
  // iOS Safari zna da vrati prazan prvi frame — probaj još jednom
  if (!blob) blob = await toBlob(node, opts);
  if (!blob) throw new Error("capture-failed");
  return blob;
}

/**
 * Snimi niz DOM čvorova (svaki je jedan slajd) u PNG blobove na traženoj rezoluciji.
 * pixelRatio se računa tako da izlaz bude ~1080px širine.
 */
export async function captureNodes(
  nodes: HTMLElement[],
  pixelRatio: number,
  onStep?: (done: number, total: number) => void,
): Promise<Blob[]> {
  const fontEmbedCSS = nodes[0] ? await getFontEmbedCSS(nodes[0]).catch(() => undefined) : undefined;
  // "zagrevanje" — prvi capture na iOS zna biti prazan; odradi ga na maloj rezoluciji
  if (nodes[0]) await toBlob(nodes[0], { pixelRatio: 0.3, fontEmbedCSS, cacheBust: true }).catch(() => null);
  const blobs: Blob[] = [];
  for (let i = 0; i < nodes.length; i++) {
    blobs.push(await nodeToBlob(nodes[i], pixelRatio, fontEmbedCSS));
    onStep?.(i + 1, nodes.length);
  }
  return blobs;
}

/** Spakuj slike u jedan .zip, numerisane po redosledu (naziv-1.png, naziv-2.png, …). */
export async function zipImages(blobs: Blob[], baseName: string): Promise<Blob> {
  const zip = new JSZip();
  blobs.forEach((b, i) => zip.file(`${baseName}-${i + 1}.png`, b));
  return zip.generateAsync({ type: "blob" });
}

// ---------------- Reels → video ----------------

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      resolve(img);
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  W: number,
  H: number,
  offsetX = 0,
) {
  const ir = img.width / img.height;
  const cr = W / H;
  let dw = W;
  let dh = H;
  if (ir > cr) {
    dh = H;
    dw = H * ir;
  } else {
    dw = W;
    dh = W / ir;
  }
  const dx = (W - dw) / 2 + offsetX;
  const dy = (H - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}

interface VideoResult {
  blob: Blob;
  ext: "mp4" | "webm";
}

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

/**
 * Napravi reels video od snimljenih slajdova (već PNG blobovi na 9:16).
 * Svaki slajd traje `perMs`, prelaz između njih poštuje project.transition.
 */
export async function exportReelsVideo(
  blobs: Blob[],
  transition: "none" | "fade" | "slide",
  onProgress?: (p: number) => void,
): Promise<VideoResult> {
  const pick = pickMime();
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const capture = (canvas as HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream }).captureStream;
  if (!ctx || !pick || typeof capture !== "function") throw new Error("video-unsupported");

  const imgs = await Promise.all(blobs.map(loadImageFromBlob));
  const stream = capture.call(canvas, 30);
  const rec = new MediaRecorder(stream, { mimeType: pick.mime, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  const finished = new Promise<Blob>((resolve) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: pick.mime }));
  });

  const PER = 2400; // ms po slajdu
  const TRANS = 520; // ms prelaz
  const total = imgs.length * PER;

  // prvi kadar odmah iscrtaj pa tek onda kreni sa snimanjem (stabilniji start)
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  drawCover(ctx, imgs[0], W, H);
  rec.start(250); // timeslice — periodični dataavailable je pouzdaniji na više browsera
  const t0 = performance.now();
  await new Promise<void>((resolve) => {
    const frame = (now: number) => {
      const el = now - t0;
      if (el >= total) {
        resolve();
        return;
      }
      const idx = Math.min(imgs.length - 1, Math.floor(el / PER));
      const into = el - idx * PER;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      if (transition !== "none" && idx > 0 && into < TRANS) {
        const p = into / TRANS;
        if (transition === "fade") {
          drawCover(ctx, imgs[idx - 1], W, H);
          ctx.globalAlpha = p;
          drawCover(ctx, imgs[idx], W, H);
          ctx.globalAlpha = 1;
        } else {
          const dx = W * p;
          drawCover(ctx, imgs[idx - 1], W, H, -dx);
          drawCover(ctx, imgs[idx], W, H, W - dx);
        }
      } else {
        drawCover(ctx, imgs[idx], W, H);
      }
      onProgress?.(el / total);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });

  // zatraži poslednji komad podataka pa stop (stabilnije zatvaranje fajla)
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
