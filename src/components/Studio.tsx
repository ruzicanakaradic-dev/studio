"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Align, CtaStyle, Format, MediaItem, Project, Slide } from "@/lib/types";
import { FORMAT_META, TEXT_COLORS, FONTS, fontCss } from "@/lib/types";
import { newProject, freshSlide, freshEmptySlide, freshText, mediaUrl } from "@/lib/samples";
import { fetchProjects, fetchMedia, persistProject, uploadMedia, deleteProject, deleteMedia } from "@/lib/store";
import {
  type BrandProfile,
  type AiSettings,
  DEFAULT_BRAND,
  DEFAULT_AI,
  PALETTE,
  HEADING_FONTS,
  BODY_FONTS,
  loadBrand,
  saveBrand,
  loadAi,
  saveAi,
  applyBrandFonts,
  AI_DAILY_LIMIT,
  getAiCallsToday,
  bumpAiCalls,
} from "@/lib/settings";
import * as I from "./icons";
import {
  zipMixed,
  downloadBlob,
  safeFileName,
  loadImage,
  renderSlidePng,
  exportSlideVideo,
  exportReelsMontage,
  videoSupported,
  isVideoUrl,
  toCaptureUrl,
  type ReelsItem,
} from "@/lib/exporter";
import { logEvent, getLog, subscribeLog, clearLog, formatWhen, type LogEntry } from "@/lib/logbook";

const FMT_ICON: Record<Format, React.FC<React.SVGProps<SVGSVGElement>>> = {
  post: I.FmtPost,
  story: I.FmtStory,
  reels: I.FmtReels,
  carousel: I.FmtCarousel,
};
const FMT_ORDER: Format[] = ["post", "story", "reels", "carousel"];

const NAV = [
  { key: "studio", label: "Studio", short: "Studio", note: "početna", icon: I.Grid },
  { key: "nova", label: "Nova objava", short: "Novo", note: "vodič", icon: I.Plus },
  { key: "platno", label: "Platno", short: "Platno", note: "editor", icon: I.ImgIcon },
  { key: "brend", label: "Brend", short: "Brend", note: "logo, boje, fontovi", icon: I.Brand },
  { key: "ai", label: "AI", short: "AI", note: "podešavanja", icon: I.Sparkle },
  { key: "log", label: "Dnevnik", short: "Dnevnik", note: "šta se dešavalo", icon: I.Journal },
] as const;

const WEEK: { day: string; title: string; status?: string; plum?: boolean }[] = [
  { day: "PON", title: "Slobodno" },
  { day: "UTO", title: "Krofne — novo", status: "ZAKAZANO" },
  { day: "SRE", title: "Citat mušterije", status: "PREDLOG", plum: true },
  { day: "ČET", title: "Slobodno" },
  { day: "PET", title: "Torta od malina", status: "PREDLOG", plum: true },
  { day: "SUB", title: "Vitrina u 8h", status: "PREDLOG", plum: true },
  { day: "NED", title: "Pakovanje 30 s", status: "PREDLOG", plum: true },
];

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3.6e6);
  if (h < 1) return "upravo sada";
  if (h < 24) return `pre ${h} ${h === 1 ? "sat" : h < 5 ? "sata" : "sati"}`;
  const d = Math.floor(h / 24);
  if (d === 1) return "juče";
  if (d < 7) return `pre ${d} dana`;
  const w = Math.floor(d / 7);
  return `pre ${w} ${w === 1 ? "nedelju" : "nedelje"}`;
}

export default function Studio() {
  const [view, setView] = useState<"studio" | "objave" | "nova" | "brend" | "ai" | "editor" | "log">("studio");
  const [logItems, setLogItems] = useState<LogEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [filter, setFilter] = useState<"all" | Format>("all");
  const [timeFilter, setTimeFilter] = useState<"all" | "24h" | "7d" | "30d">("all");
  const [newOpen, setNewOpen] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [active, setActive] = useState(0);
  const [propTab, setPropTab] = useState<"foto" | "text" | "cta" | "layer" | "brend" | "red" | "ai" | "safe">("text");
  const [isMobile, setIsMobile] = useState(false);
  const [wizStep, setWizStep] = useState(0);
  const [wizCaps, setWizCaps] = useState<{ kicker: string; text: string }[]>([]);
  const [sheet, setSheet] = useState<null | "media" | "props">(null);
  const [selId, setSelId] = useState<string | null>(null); // text layer id, "cta", or null
  const [toast, setToast] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const [safeZone, setSafeZone] = useState(false);
  const [aiBandOff, setAiBandOff] = useState(false);
  const [aiIdea, setAiIdea] = useState("");
  const [aiTone, setAiTone] = useState("Toplo i primamljivo");
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiSuggest, setAiSuggest] = useState<{ title?: string; subtitle?: string; cta?: string } | null>(null);
  const [aiCaption, setAiCaption] = useState<{ caption?: string; hashtags?: string[] } | null>(null);
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [brand, setBrand] = useState<BrandProfile>(DEFAULT_BRAND);
  const [aiSet, setAiSet] = useState<AiSettings>(DEFAULT_AI);
  const [aiTest, setAiTest] = useState<string | null>(null);
  const [aiCalls, setAiCalls] = useState(0);
  const [aiLimited, setAiLimited] = useState(false);
  const [novaFmt, setNovaFmt] = useState<Format>("post");
  const [novaPhotos, setNovaPhotos] = useState<string[]>([]);
  const [novaTopic, setNovaTopic] = useState("Torta od malina, nova ove nedelje");
  const [novaCaps, setNovaCaps] = useState<{ kicker: string; text: string }[]>([]);
  const [novaCapIdx, setNovaCapIdx] = useState(0);
  const [exportUI, setExportUI] = useState<null | {
    pct: number;
    label: string;
    error?: boolean;
    files?: File[]; // spremni fajlovi za „Sačuvaj u Photos"
    base?: string;
  }>(null);
  const [vidPlaying, setVidPlaying] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const bgVideoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    fetchProjects().then(setProjects);
    fetchMedia().then(setMedia);
    const b = loadBrand();
    setBrand(b);
    applyBrandFonts(b);
    setAiSet(loadAi());
    setAiCalls(getAiCallsToday());
  }, []);

  // persist + apply brand fonts live
  const updateBrand = useCallback((patch: Partial<BrandProfile>) => {
    setBrand((prev) => {
      const next = { ...prev, ...patch };
      saveBrand(next);
      applyBrandFonts(next);
      return next;
    });
  }, []);
  const updateAi = useCallback((patch: Partial<AiSettings>) => {
    setAiSet((prev) => {
      const next = { ...prev, ...patch };
      saveAi(next);
      return next;
    });
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  const slide = project?.slides[active] ?? null;
  const fmt = project ? FORMAT_META[project.format] : null;
  const selText = slide?.texts.find((t) => t.id === selId) ?? null;

  // bezbedna zona (margine) — ručno podešene ili podrazumevane po formatu
  const curSafe = project?.safe ?? fmt?.safe ?? { top: 0.05, bottom: 0.08, left: 0.05, right: 0.05 };
  function setSafeInset(edge: "top" | "bottom" | "left" | "right", val: number) {
    setProject((p) => (p ? { ...p, safe: { ...(p.safe ?? FORMAT_META[p.format].safe), [edge]: val } } : p));
  }
  function resetSafe() {
    setProject((p) => (p ? { ...p, safe: undefined } : p));
  }
  function outsideSafe(x: number, y: number): boolean {
    return x < curSafe.left * 100 || x > (1 - curSafe.right) * 100 || y < curSafe.top * 100 || y > (1 - curSafe.bottom) * 100;
  }
  function clampSafe(pos: { x: number; y: number }): { x: number; y: number } {
    return {
      x: Math.min(Math.max(pos.x, curSafe.left * 100), (1 - curSafe.right) * 100),
      y: Math.min(Math.max(pos.y, curSafe.top * 100), (1 - curSafe.bottom) * 100),
    };
  }

  // pri promeni slajda/medija zaustavi video pregled
  useEffect(() => {
    bgVideoRef.current?.pause();
    setVidPlaying(false);
  }, [active, slide?.mediaId]);

  // dnevnik (log) — osveži prikaz kad stigne nov događaj
  useEffect(() => {
    setLogItems(getLog());
    return subscribeLog(() => setLogItems([...getLog()]));
  }, []);

  // prati da li smo na telefonu (za vođeni tok / wizard)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 760px)");
    const on = () => setIsMobile(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);

  // koraci vođenog toka (na telefonu)
  const wizSteps: { key: string; label: string }[] = fmt
    ? [
        { key: "media", label: "Slike i video" },
        { key: "text", label: "Tekst" },
        { key: "look", label: "Izgled" },
        ...(fmt.multi ? [{ key: "anim", label: "Animacija" }] : []),
        { key: "done", label: "Sačuvaj" },
      ]
    : [];
  const wizard = isMobile && view === "editor";
  const stepKey = wizSteps[wizStep]?.key ?? "media";

  // svaki ulazak u editor kreće od prvog koraka
  useEffect(() => {
    if (view === "editor") setWizStep(0);
  }, [view]);

  // u vođenom toku, korak diktira koji panel se koristi
  useEffect(() => {
    if (!wizard) return;
    if (stepKey === "text") setPropTab("text");
    else setPropTab("layer"); // media/look/anim/done imaju svoj sadržaj
    setSelId(null);
  }, [wizard, stepKey]);

  const patchSlide = useCallback(
    (patch: Partial<Slide>) => {
      setProject((p) => {
        if (!p) return p;
        const slides = p.slides.slice();
        slides[active] = { ...slides[active], ...patch };
        return { ...p, slides };
      });
    },
    [active],
  );

  const patchText = useCallback(
    (id: string, patch: Partial<Slide["texts"][number]>) => {
      setProject((p) => {
        if (!p) return p;
        const slides = p.slides.slice();
        const cur = { ...slides[active] };
        cur.texts = cur.texts.map((t) => (t.id === id ? { ...t, ...patch } : t));
        slides[active] = cur;
        return { ...p, slides };
      });
    },
    [active],
  );

  function addText() {
    const t = freshText({ pos: { x: 12, y: 40 } });
    setProject((p) => {
      if (!p) return p;
      const slides = p.slides.slice();
      const cur = { ...slides[active] };
      cur.texts = [...cur.texts, t];
      slides[active] = cur;
      return { ...p, slides };
    });
    setSelId(t.id);
    setPropTab("text");
  }
  function deleteText(id: string) {
    setProject((p) => {
      if (!p) return p;
      const slides = p.slides.slice();
      const cur = { ...slides[active] };
      cur.texts = cur.texts.filter((t) => t.id !== id);
      slides[active] = cur;
      return { ...p, slides };
    });
    setSelId((s) => (s === id ? null : s));
  }

  // ---- navigation ----
  function openEditor(p: Project) {
    setProject(structuredClone(p));
    setActive(0);
    setPropTab("text");
    setSelId(null);
    setSafeZone(false);
    setWizStep(0);
    setView("editor");
    setSheet(null);
  }
  // otvori izbor tipa objave (bez ikakvog AI-a) — klik na tip vodi na prazan canvas
  function openNew() {
    setNewOpen(true);
  }
  function createProject(format: Format) {
    setNewOpen(false);
    // prazan canvas — bez teksta i CTA
    const p = newProject(format, "Nova objava");
    p.slides = [freshEmptySlide(null)];
    p.caption = "";
    openEditor(p);
  }
  function onNav(k: string) {
    if (k === "nova") {
      openNew();
      return;
    }
    if (k === "platno") {
      if (project) setView("editor");
      else openNew();
      return;
    }
    setView(k as "studio" | "objave" | "brend" | "ai" | "nova" | "log");
  }
  function togglePhoto(id: string) {
    setNovaPhotos((ps) => (ps.includes(id) ? ps.filter((x) => x !== id) : [...ps, id]));
  }
  async function doNovaCaptions() {
    const d = await askAI("captions3", { idea: novaTopic, format: FORMAT_META[novaFmt].short });
    if (d?.options) {
      setNovaCaps(d.options);
      setNovaCapIdx(0);
    }
  }
  function buildNovaProject(): Project {
    const title = (novaTopic.split(",")[0] || "Nova objava").trim();
    const photos = novaPhotos.length ? novaPhotos : [null];
    const p = newProject(novaFmt, title);
    p.slides = photos.map((ph, i) => {
      const s = freshSlide(ph);
      if (i === 0) {
        s.texts = [
          freshText({ content: "Novo ove nedelje", font: "archivo", size: 14, pos: { x: 8, y: 76 } }),
          freshText({ content: title, font: brand.headingFont, size: 34, pos: { x: 8, y: 81 } }),
        ];
      }
      return s;
    });
    p.caption = novaCaps[novaCapIdx]?.text;
    return p;
  }
  function novaToEditor() {
    openEditor(buildNovaProject());
  }
  async function novaSaveDraft() {
    const p = buildNovaProject();
    const res = await persistProject({ ...p, coverMediaId: p.slides[0]?.mediaId ?? null, updatedAt: new Date().toISOString() });
    setProjects(await fetchProjects());
    showToast(res.demo ? "Sačuvano kao nacrt (demo)" : "Sačuvano kao nacrt");
    setView("objave");
  }
  async function save(exported = false) {
    if (!project) return;
    const toSave = {
      ...project,
      coverMediaId: project.slides[0]?.mediaId ?? project.coverMediaId,
      updatedAt: new Date().toISOString(),
    };
    const res = await persistProject(toSave);
    if (res.id && res.id !== project.id) setProject((p) => (p ? { ...p, id: res.id! } : p));
    setProjects(await fetchProjects());
    if (exported) showToast(res.demo ? "Izvezeno (demo režim)" : "Izvezeno — spremno za Instagram ✦");
    else showToast(res.demo ? "Sačuvano (demo režim)" : "Sačuvano");
  }

  // ---- isporuka izvezenih fajlova ----
  function filesFromOutputs(outputs: { name: string; blob: Blob }[]): File[] {
    return outputs.map((o) => {
      const type = o.name.endsWith(".png")
        ? "image/png"
        : o.name.endsWith(".webm")
          ? "video/webm"
          : "video/mp4";
      return new File([o.blob], o.name, { type });
    });
  }
  function canShareFiles(files: File[]): boolean {
    try {
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      return !!(
        files.length &&
        typeof navigator.share === "function" &&
        typeof nav.canShare === "function" &&
        nav.canShare({ files })
      );
    } catch {
      return false;
    }
  }
  async function downloadOutputs(files: File[], base: string) {
    if (files.length === 1) {
      downloadBlob(files[0], files[0].name);
    } else {
      const zip = await zipMixed(files.map((f) => ({ name: f.name, blob: f })));
      downloadBlob(zip, `${base}.zip`);
    }
  }
  // tap na „Sačuvaj u Photos" — otvara iOS meni za čuvanje u galeriju
  async function shareExport() {
    const files = exportUI?.files;
    const base = exportUI?.base || "objava";
    if (!files || files.length === 0) return;
    try {
      await (navigator as Navigator & { share: (d: { files: File[] }) => Promise<void> }).share({ files });
      logEvent("ok", "Sačuvano", "Otvoren je meni za čuvanje u Photos / galeriju.");
      setExportUI(null);
    } catch (err) {
      // AbortError = korisnik otkazao → ostavi dugme da može opet
      if ((err as Error)?.name === "AbortError") return;
      await downloadOutputs(files, base);
      setExportUI({ pct: 100, label: files.length > 1 ? `${files.length} fajla preuzeto ✦` : "Preuzeto ✦" });
      setTimeout(() => setExportUI(null), 2500);
    }
  }

  // ---- stvarni izvoz: sve se crta direktno na canvasu (pouzdano na iOS-u) ----
  async function runExport() {
    if (!project || exportUI) return;
    const proj = project;
    const fmt = FORMAT_META[proj.format];
    // prepoznaj po svakom slajdu da li je slika ili video (po stvarnom fajlu)
    const items: { slide: Slide; video: boolean; src: string | null }[] = proj.slides
      .filter((s) => s.mediaId)
      .map((slide) => ({ slide, video: isVideoUrl(mediaUrl(slide.mediaId)), src: mediaUrl(slide.mediaId) }));
    if (items.length === 0) {
      showToast("Dodaj bar jedan medij pre izvoza");
      return;
    }
    const hasVideo = items.some((it) => it.video);
    const isReels = proj.format === "reels";
    let awaitingShare = false; // ako čekamo tap na „Sačuvaj u Photos" — ne gasi preklop automatski

    logEvent("info", `Počeo izvoz objave „${proj.name}"`, `Format: ${fmt.short} · ${items.length} ${items.length === 1 ? "medij" : "medija"}${hasVideo ? " (ima videa)" : ""}.`);

    // izmeri trenutno platno da izvoz bude 1:1 sa onim što se vidi
    const rect = canvasRef.current?.getBoundingClientRect();
    const width = Math.round(rect?.width || 440);
    const W = fmt.w;
    const H = fmt.h;
    const scale = W / width; // font/CTA veličine su relativne na platno

    setExportUI({ pct: 0, label: isReels || hasVideo ? "Spremam…" : "Spremam slike…" });

    // učitaj medije lokalno (blob) da sigurno uđu u izvoz (bez CORS/keš-taint problema)
    const objectUrls: string[] = [];
    let loadFails = 0;
    for (const it of items) {
      const orig = mediaUrl(it.slide.mediaId);
      const safe = await toCaptureUrl(orig);
      if (orig && !orig.startsWith("/") && (!safe || !safe.startsWith("blob:"))) loadFails += 1;
      it.src = safe;
      if (safe && safe.startsWith("blob:")) objectUrls.push(safe);
    }
    if (loadFails > 0) {
      logEvent("warn", "Neki mediji se nisu učitali za izvoz", `${loadFails} ${loadFails === 1 ? "medij nije uspeo" : "medija nije uspelo"} da se pripremi — možda internet ili medij nije dostupan. Pokušavam i dalje.`);
    }

    // učitaj slike u memoriju (za crtanje)
    async function imgFor(src: string | null): Promise<HTMLImageElement | null> {
      if (!src) return null;
      try {
        return await loadImage(src);
      } catch {
        return null;
      }
    }

    if (typeof document !== "undefined" && document.fonts?.ready) {
      try {
        await document.fonts.ready;
      } catch {
        /* ignore */
      }
    }

    const base = safeFileName(proj.name);
    const outputs: { name: string; blob: Blob }[] = [];
    try {
      if (isReels) {
        // montaža: slike stoje, video slajdovi se puštaju — jedan .mp4
        let ok = false;
        if (videoSupported()) {
          try {
            setExportUI({ pct: 20, label: "Snimam video…" });
            const ritems: ReelsItem[] = [];
            for (const it of items) {
              if (it.video) ritems.push({ slide: it.slide, kind: "video", url: (it.src || mediaUrl(it.slide.mediaId))! });
              else ritems.push({ slide: it.slide, kind: "image", imgEl: await imgFor(it.src) });
            }
            const { blob, ext } = await exportReelsMontage(ritems, W, H, scale, proj.transition, (p) =>
              setExportUI({ pct: 20 + Math.round(p * 75), label: "Snimam video…" }),
            );
            outputs.push({ name: `${base}.${ext}`, blob });
            ok = true;
          } catch (e) {
            logEvent("warn", "Snimanje videa nije uspelo", "Umesto videa čuvam pojedinačne kadrove (slike).");
            console.warn("reels montage fallback", e);
          }
        } else {
          logEvent("warn", "Ovaj pregledač ne podržava snimanje videa", "Umesto videa čuvam kadrove kao slike.");
        }
        if (!ok) {
          for (let i = 0; i < items.length; i++) {
            const im = await imgFor(items[i].src);
            outputs.push({ name: `${base}-${i + 1}.png`, blob: await renderSlidePng(items[i].slide, im, W, H, scale) });
          }
        }
      } else {
        // Objava / Story / Carousel — po slajdu: slika → PNG, video → MP4/WebM
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          const nm = items.length === 1 ? base : `${base}-${i + 1}`;
          if (!it.video) {
            setExportUI({ pct: Math.round((i / items.length) * 90), label: `Spremam sliku ${i + 1}/${items.length}…` });
            const im = await imgFor(it.src);
            try {
              outputs.push({ name: `${nm}.png`, blob: await renderSlidePng(it.slide, im, W, H, scale) });
            } catch (e) {
              console.warn("render slide fail", e);
              logEvent("warn", `Slajd ${i + 1} preskočen`, "Sliku nije bilo moguće pripremiti.");
            }
          } else {
            setExportUI({ pct: Math.round((i / items.length) * 90), label: `Snimam video ${i + 1}/${items.length}…` });
            try {
              const { blob, ext } = await exportSlideVideo({
                slide: it.slide,
                url: (it.src || mediaUrl(it.slide.mediaId))!,
                W,
                H,
                scale,
                onProgress: (p) =>
                  setExportUI({ pct: Math.round(((i + p) / items.length) * 90), label: `Snimam video ${i + 1}/${items.length}…` }),
              });
              outputs.push({ name: `${nm}.${ext}`, blob });
            } catch (e) {
              console.warn("video slide fallback → original", e);
              // fallback 1: originalni video fajl (bez uklopljenog teksta)
              try {
                const url = (it.src || mediaUrl(it.slide.mediaId))!;
                const r = await fetch(url);
                const blob = await r.blob();
                const m = mediaUrl(it.slide.mediaId)?.match(/\.(mp4|mov|webm|m4v)(\?|#|$)/i);
                outputs.push({ name: `${nm}.${(m?.[1] || "mp4").toLowerCase()}`, blob });
                logEvent("warn", `Tekst nije uklopljen na video (slajd ${i + 1})`, "Sačuvao sam originalni video bez teksta preko njega.");
              } catch {
                // fallback 2: bar poster kao slika
                try {
                  const im = await imgFor(it.src);
                  outputs.push({ name: `${nm}.png`, blob: await renderSlidePng(it.slide, im, W, H, scale) });
                } catch {
                  /* preskoči */
                }
              }
            }
          }
        }
      }

      if (outputs.length === 0) throw new Error("nema-izlaza");

      // ── Isporuka: na telefonu „Sačuvaj u Photos", inače preuzimanje ──
      const files = filesFromOutputs(outputs);
      const nImg = files.filter((f) => f.name.endsWith(".png")).length;
      const nVid = files.length - nImg;
      const kindTxt = files.length > 1 ? `${nImg} slika${nVid ? ` + ${nVid} video` : ""}` : nImg ? "slika" : "video";
      if (canShareFiles(files)) {
        awaitingShare = true;
        setExportUI({
          pct: 100,
          label: files.length > 1 ? `Spremno — ${files.length} fajla` : "Spremno ✦",
          files,
          base,
        });
        logEvent("ok", "Izvoz spreman za čuvanje", `Tapni „Sačuvaj u Photos" da ${files.length > 1 ? "sačuvaš sve u galeriju" : "sačuvaš u galeriju"} (${kindTxt}).`);
      } else {
        await downloadOutputs(files, base);
        setExportUI({ pct: 100, label: files.length > 1 ? `${files.length} fajla preuzeto ✦` : "Preuzeto ✦" });
        logEvent("ok", "Izvezeno", files.length > 1 ? `${kindTxt} — preuzeto (${files.length > 1 ? ".zip" : ""}).` : `${files[0].name} preuzeto na uređaj.`);
      }

      persistProject({ ...proj, updatedAt: new Date().toISOString() }).catch(() => {});
    } catch (err) {
      console.error("export", err);
      const msg = err instanceof Error ? err.message : String(err);
      const friendly =
        msg === "nema-izlaza"
          ? "Nisam uspeo da pripremim nijedan fajl — proveri da li se medij vidi na platnu i da imaš internet."
          : "Nešto je zapelo pri izvozu. Proveri internet i pokušaj ponovo.";
      setExportUI({ pct: 100, label: "Izvoz nije uspeo. Pokušaj ponovo.", error: true });
      logEvent("error", "Izvoz nije uspeo", `${friendly} (tehnički: ${msg})`);
    } finally {
      objectUrls.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {
          /* ignore */
        }
      });
      if (!awaitingShare) setTimeout(() => setExportUI(null), 2800);
    }
  }

  // ---- drag (text layer / cta) ----
  function startDrag(target: { kind: "text"; id: string } | { kind: "cta" }, e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    setSelId(target.kind === "cta" ? "cta" : target.id);
    if (target.kind === "cta") setPropTab("cta");
    else setPropTab("text");
    const canvas = canvasRef.current;
    if (!canvas || !slide) return;
    const rect = canvas.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY };
    const origin =
      target.kind === "cta"
        ? { ...slide.ctaPos }
        : { ...(slide.texts.find((t) => t.id === target.id)?.pos ?? { x: 0, y: 0 }) };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const move = (ev: PointerEvent) => {
      let nx = origin.x + ((ev.clientX - start.x) / rect.width) * 100;
      let ny = origin.y + ((ev.clientY - start.y) / rect.height) * 100;
      nx = Math.max(2, Math.min(90, nx));
      ny = Math.max(2, Math.min(94, ny));
      setProject((p) => {
        if (!p) return p;
        const slides = p.slides.slice();
        const cur = { ...slides[active] };
        if (target.kind === "cta") cur.ctaPos = { x: nx, y: ny };
        else cur.texts = cur.texts.map((t) => (t.id === target.id ? { ...t, pos: { x: nx, y: ny } } : t));
        slides[active] = cur;
        return { ...p, slides };
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // ---- background pan (kadriranje) ----
  function startBgPan(e: React.PointerEvent) {
    if (!slide?.mediaId) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY };
    const origin = { ...slide.focus };
    const move = (ev: PointerEvent) => {
      const dx = ((ev.clientX - start.x) / rect.width) * 100;
      const dy = ((ev.clientY - start.y) / rect.height) * 100;
      const fx = Math.max(0, Math.min(100, origin.x - dx));
      const fy = Math.max(0, Math.min(100, origin.y - dy));
      setProject((p) => {
        if (!p) return p;
        const slides = p.slides.slice();
        slides[active] = { ...slides[active], focus: { x: fx, y: fy } };
        return { ...p, slides };
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // ---- media ----
  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const item = await uploadMedia(file);
    if (item) {
      setMedia((m) => [item, ...m]);
      patchSlide({ mediaId: item.id });
      showToast("Otpremljeno");
      logEvent("ok", `Dodat ${item.kind === "video" ? "video" : "slika"} — ${item.name}`, "Medij je otpremljen i dodat na platno.");
    } else {
      showToast("Upload radi kad se poveže Supabase Storage");
      logEvent("warn", "Otpremanje nije uspelo", "Medij nije otpremljen — proveri vezu sa skladištem (Supabase).");
    }
    e.target.value = "";
  }
  function pickMedia(id: string) {
    patchSlide({ mediaId: id });
    if (window.innerWidth <= 760) setSheet(null);
  }
  // vođeni tok: dodaj/ukloni medij kao stranu (dozvoljava više slika/videa, mešano)
  function wizToggleMedia(id: string) {
    if (!project) return;
    const slides = [...project.slides];
    const used = slides.findIndex((s) => s.mediaId === id);
    let nextActive = active;
    if (used >= 0) {
      if (slides.length > 1) {
        slides.splice(used, 1);
        nextActive = Math.max(0, Math.min(active, slides.length - 1));
      } else {
        slides[0] = { ...slides[0], mediaId: null };
        nextActive = 0;
      }
    } else {
      const emptyIdx = slides.findIndex((s) => !s.mediaId);
      if (emptyIdx >= 0) {
        slides[emptyIdx] = { ...slides[emptyIdx], mediaId: id };
        nextActive = emptyIdx;
      } else {
        slides.push(freshEmptySlide(id));
        nextActive = slides.length - 1;
      }
    }
    setProject({ ...project, slides, coverMediaId: slides[0]?.mediaId ?? null });
    setActive(nextActive);
  }
  function slideIndexForMedia(id: string): number {
    return project ? project.slides.findIndex((s) => s.mediaId === id) : -1;
  }
  // video thumbnail: #t=0.1 tera browser da prikaže prvi kadar kao poster
  function vposter(url: string): string {
    return url.includes("#") ? url : `${url}#t=0.1`;
  }
  // obriši medij iz biblioteke „Ranije korišćeno"
  async function removeMedia(e: React.MouseEvent, item: MediaItem) {
    e.stopPropagation();
    if (!window.confirm(`Obrisati „${item.name}"? Ukloniće se iz biblioteke.`)) return;
    setMedia((m) => m.filter((x) => x.id !== item.id));
    setProject((p) => (p ? { ...p, slides: p.slides.map((s) => (s.mediaId === item.id ? { ...s, mediaId: null } : s)) } : p));
    await deleteMedia(item.url);
    showToast("Obrisano");
    logEvent("info", `Obrisan medij — ${item.name}`, "Uklonjen iz biblioteke.");
  }
  // vođeni tok: upload iz Photos galerije / kamere — svaka datoteka postaje strana
  async function onWizUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    setExportUI(null);
    showToast(files.length > 1 ? `Otpremam ${files.length}…` : "Otpremam…");
    const items: MediaItem[] = [];
    for (const f of files) {
      const it = await uploadMedia(f);
      if (it) items.push(it);
    }
    if (items.length === 0) {
      showToast("Otpremanje radi kad je Supabase Storage povezan");
      logEvent("warn", "Otpremanje nije uspelo", "Medij nije otpremljen — proveri vezu sa skladištem (Supabase).");
      return;
    }
    setMedia((m) => [...items, ...m]);
    const baseP = project;
    if (baseP) {
      const slides = [...baseP.slides];
      for (const it of items) {
        const emptyIdx = slides.findIndex((s) => !s.mediaId);
        if (emptyIdx >= 0) slides[emptyIdx] = { ...slides[emptyIdx], mediaId: it.id };
        else slides.push(freshEmptySlide(it.id));
      }
      setProject({ ...baseP, slides, coverMediaId: slides[0]?.mediaId ?? null });
      setActive(slides.length - 1);
    }
    showToast(items.length > 1 ? `Dodato ${items.length}` : "Dodato");
    logEvent("ok", `Dodat${items.length > 1 ? "o " + items.length + " medija" : " medij"}`, "Medij je otpremljen i dodat na platno.");
  }

  // vođeni tok: AI predlog opisa (caption)
  async function doWizCaption() {
    const idea = (project?.caption || project?.name || "domaći kolači").trim();
    const d = await askAI("captions3", { idea, format: fmt?.short });
    if (d?.options) setWizCaps(d.options);
  }
  function addSlide() {
    setProject((p) => {
      if (!p || p.slides.length >= 20) return p;
      const slides = [...p.slides, freshSlide(null)];
      setActive(slides.length - 1);
      return { ...p, slides };
    });
  }
  function deleteSlide() {
    setProject((p) => {
      if (!p || p.slides.length <= 1) return p;
      const slides = p.slides.filter((_, i) => i !== active);
      setActive(Math.max(0, active - 1));
      return { ...p, slides };
    });
  }

  // ---- delete project ----
  async function removeProject(e: React.MouseEvent, id: string, name: string) {
    e.stopPropagation();
    if (!window.confirm(`Obrisati projekat „${name}"? Ovo se ne može poništiti.`)) return;
    setProjects((list) => list.filter((p) => p.id !== id));
    await deleteProject(id);
    showToast("Projekat obrisan");
    logEvent("info", `Obrisana objava — „${name}"`, "Objava je uklonjena iz Studija.");
  }

  // ---- preview ----
  function clearPreviewTimers() {
    previewTimers.current.forEach(clearTimeout);
    previewTimers.current = [];
  }
  function playPreview() {
    if (!project || !fmt) return;
    clearPreviewTimers();
    setPreviewing(true);
    setActive(0);
    setAnimKey((k) => k + 1);
    // ako je slajd video — pusti ga u pregledu
    const v = bgVideoRef.current;
    if (v) {
      v.currentTime = 0;
      v.play().catch(() => {});
    }
    const n = fmt.multi ? project.slides.length : 1;
    const step = 2200;
    for (let i = 1; i < n; i++) {
      previewTimers.current.push(
        setTimeout(() => {
          setActive(i);
          setAnimKey((k) => k + 1);
        }, step * i),
      );
    }
    previewTimers.current.push(setTimeout(() => setPreviewing(false), step * n + 600));
  }
  useEffect(() => () => clearPreviewTimers(), []);

  // ---- AI ----
  async function askAI(mode: string, payload: Record<string, unknown>) {
    setAiBusy(mode);
    setAiMsg(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          brand: { toneChips: brand.toneChips, toneText: brand.toneText, bannedWords: brand.bannedWords },
          ai: { textLength: aiSet.textLength, emoji: aiSet.emoji, hashtags: aiSet.permissions.hashtags },
          ...payload,
        }),
      });
      const data = await res.json();
      if (data?.error) {
        if (data?.quota) setAiLimited(true);
        setAiMsg(
          data?.detail
            ? `AI greška: ${data.detail}`
            : "AI trenutno nije dostupan — proveri da je GEMINI_API_KEY (ili ANTHROPIC_API_KEY) dodat u Vercel.",
        );
        return null;
      }
      if (data?.demo) setAiMsg("Demo režim — dodaj GEMINI_API_KEY (besplatno) ili ANTHROPIC_API_KEY u Vercel za pravi AI.");
      else {
        setAiLimited(false);
        setAiCalls(bumpAiCalls());
      }
      return data;
    } catch {
      setAiMsg("Greška u komunikaciji sa AI-jem.");
      return null;
    } finally {
      setAiBusy(null);
    }
  }
  async function copyText(t: string) {
    try {
      await navigator.clipboard.writeText(t);
      showToast("Kopirano");
    } catch {
      showToast("Kopiranje nije uspelo");
    }
  }
  async function doSuggest() {
    if (!project) return;
    const d = await askAI("suggest", { idea: aiIdea, format: FORMAT_META[project.format].short });
    if (d) setAiSuggest(d);
  }
  function insertSuggested() {
    if (!aiSuggest) return;
    setProject((p) => {
      if (!p) return p;
      const slides = p.slides.slice();
      const cur = { ...slides[active] };
      const adds = [];
      if (aiSuggest.title) adds.push(freshText({ content: aiSuggest.title, font: "playfair", size: 40, pos: { x: 8, y: 50 } }));
      if (aiSuggest.subtitle) adds.push(freshText({ content: aiSuggest.subtitle, font: "archivo", size: 18, pos: { x: 8, y: 65 } }));
      cur.texts = [...cur.texts, ...adds];
      if (aiSuggest.cta) {
        cur.cta = true;
        cur.ctaText = aiSuggest.cta;
      }
      slides[active] = cur;
      return { ...p, slides };
    });
    showToast("Ubačeno na platno");
  }
  async function doCaption() {
    if (!project || !slide) return;
    const d = await askAI("caption", {
      idea: aiIdea || slide.texts.map((t) => t.content).join(", "),
      format: FORMAT_META[project.format].short,
      texts: slide.texts.map((t) => t.content),
    });
    if (d) setAiCaption(d);
  }
  async function doImprove() {
    if (!selText || !project) return;
    const d = await askAI("improve", { text: selText.content, tone: aiTone, format: FORMAT_META[project.format].short });
    if (d?.content) {
      patchText(selText.id, { content: d.content });
      showToast("Tekst poboljšan");
    }
  }
  async function doLayout() {
    if (!project || !slide || slide.texts.length === 0) return;
    const d = await askAI("layout", { texts: slide.texts.map((t) => t.content), format: FORMAT_META[project.format].short });
    if (d?.layout && Array.isArray(d.layout)) {
      setProject((p) => {
        if (!p) return p;
        const slides = p.slides.slice();
        const cur = { ...slides[active] };
        cur.texts = cur.texts.map((t, i) => {
          const l = d.layout[i];
          if (!l) return t;
          return {
            ...t,
            pos: { x: Math.max(2, Math.min(90, l.x ?? t.pos.x)), y: Math.max(2, Math.min(92, l.y ?? t.pos.y)) },
            size: l.size ?? t.size,
            align: l.align ?? t.align,
          };
        });
        slides[active] = cur;
        return { ...p, slides };
      });
      showToast("Raspoređeno");
    }
  }
  async function doTest() {
    const d = await askAI("test", {});
    if (d?.content) setAiTest(d.content);
  }

  // vidljive objave: filter po tipu + vremenu, pa hronološki (najnovije prvo)
  const timeCut =
    timeFilter === "24h" ? 864e5 : timeFilter === "7d" ? 6048e5 : timeFilter === "30d" ? 2592e6 : Infinity;
  const nowMs = Date.now();
  const visibleProjects = projects
    .filter((p) => (filter === "all" ? true : p.format === filter))
    .filter((p) => {
      const t = new Date(p.updatedAt).getTime();
      if (Number.isNaN(t)) return true;
      return nowMs - t <= timeCut;
    })
    .sort((a, b) => {
      const ta = new Date(a.updatedAt).getTime() || 0;
      const tb = new Date(b.updatedAt).getTime() || 0;
      return tb - ta;
    });
  const TIME_FILTERS: { key: "all" | "24h" | "7d" | "30d"; label: string }[] = [
    { key: "all", label: "Sve" },
    { key: "24h", label: "24h" },
    { key: "7d", label: "7 dana" },
    { key: "30d", label: "Mesec" },
  ];
  const TYPE_FILTERS: { key: "all" | Format; label: string }[] = [
    { key: "all", label: "Svi tipovi" },
    { key: "post", label: FORMAT_META.post.short },
    { key: "story", label: FORMAT_META.story.short },
    { key: "reels", label: FORMAT_META.reels.short },
    { key: "carousel", label: FORMAT_META.carousel.short },
  ];
  const textAnimStyle = (delay: number): React.CSSProperties =>
    previewing && project && project.textAnim !== "none"
      ? { animation: `${project.textAnim === "rise" ? "fxRise" : "fxFade"} .55s ease ${delay}s both` }
      : {};

  return (
    <div className="app">
      {/* ===== SHELL: sidebar + main ===== */}
      <div className="shell">
        <aside className="sidebar2">
          <div className="side-brand">
            <span className="logo-mark" aria-hidden>
              <img src="/brand/logo.png" alt="Ružini domaći kolači" />
            </span>
            <span className="brand-txt">
              <b>Ružini domaći kolači</b>
              <span>Studio</span>
            </span>
          </div>
          <nav className="side-nav">
            {NAV.map((n) => {
              const Ico = n.icon;
              const active = view === n.key || (n.key === "platno" && view === "editor");
              return (
                <button key={n.key} className={`nav2${active ? " on" : ""}`} onClick={() => onNav(n.key)}>
                  <Ico />
                  <span className="nav2-txt">
                    <b>{n.label}</b>
                    <i>{n.note}</i>
                  </span>
                </button>
              );
            })}
          </nav>
          <div className="side-user">
            <span className="avatar">R</span>
            <span className="nav2-txt">
              <b>Ružica</b>
              <i>2 SARADNIKA</i>
            </span>
          </div>
        </aside>

        <main className="shell-main">
          {/* ---------- STUDIO HOME ---------- */}
          {view === "studio" && (
            <div className="screen-scroll home">
              <div className="home-head">
                <div>
                  <h1 className="page-title">
                    Zdravo, Ružica <span style={{ fontFamily: "var(--font-body)" }}>👋</span>
                  </h1>
                  <p className="page-sub">Petak je — vikend traži kolače.</p>
                </div>
                <button className="btn btn-primary btn-cta" onClick={openNew}>
                  Nova objava <I.Arrow />
                </button>
              </div>

              <div className="home-grid">
                {!aiBandOff && (
                  <div className="ai-band">
                    <div className="ai-band-photo" style={{ backgroundImage: "url(/samples/tray-1.jpg)" }}>
                      <span className="pill-plum">AI predlog za danas</span>
                    </div>
                    <div className="ai-band-body">
                      <h2 className="serif">Reels: pakovanje narudžbine za vikend</h2>
                      <p>
                        Reelsi sa pakovanjem imaju 2× više pregleda od fotografija. Tekst i muzika su
                        već predloženi — treba ti 30 sekundi snimka.
                      </p>
                      <div className="ai-band-actions">
                        <button className="btn btn-outline" onClick={openNew}>
                          Otvori predlog
                        </button>
                        <button className="btn btn-text" onClick={() => setAiBandOff(true)}>
                          Ne danas
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="week-card">
                  <div className="mono-label">Nedelja</div>
                  {WEEK.map((w) => (
                    <div className="week-row" key={w.day}>
                      <span className="week-day">{w.day}</span>
                      <span className="week-title">{w.title}</span>
                      {w.status && <span className={`week-status ${w.plum ? "plum" : ""}`}>{w.status}</span>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mono-label" style={{ marginTop: 30 }}>
                Poslednje objave
              </div>
              <div className="filter-bar">
                <div className="filter-seg">
                  {TYPE_FILTERS.map((t) => (
                    <button
                      key={t.key}
                      className={`filter-chip ${filter === t.key ? "on" : ""}`}
                      onClick={() => setFilter(t.key)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="filter-seg">
                  {TIME_FILTERS.map((t) => (
                    <button
                      key={t.key}
                      className={`filter-chip ${timeFilter === t.key ? "on" : ""}`}
                      onClick={() => setTimeFilter(t.key)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              {visibleProjects.length === 0 ? (
                <div className="posts-empty">Nema objava za izabrani filter.</div>
              ) : (
                <div className="posts-grid">
                  {visibleProjects.map((p) => {
                    const url = mediaUrl(p.coverMediaId);
                    const Ico = FMT_ICON[p.format];
                    return (
                      <div key={p.id} className="post-tile" role="button" tabIndex={0} onClick={() => openEditor(p)}>
                        {url && (isVideoUrl(url) ? <video src={vposter(url)} muted playsInline preload="metadata" /> : <img src={url} alt="" />)}
                        <span className="post-badge">
                          <Ico /> {FORMAT_META[p.format].short}
                        </span>
                        <button className="card-del" title="Obriši" onClick={(e) => removeProject(e, p.id, p.name)}>
                          <I.Trash />
                        </button>
                        <span className="post-name">{p.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ---------- OBJAVE ---------- */}
          {view === "objave" && (
            <div className="screen-scroll home">
              <div className="home-head">
                <div>
                  <h1 className="page-title">Objave</h1>
                  <p className="page-sub">Sve tvoje objave na jednom mestu.</p>
                </div>
                <button className="btn btn-primary btn-cta" onClick={openNew}>
                  Nova objava <I.Arrow />
                </button>
              </div>
              <div className="filter-bar">
                <div className="filter-seg">
                  {TYPE_FILTERS.map((t) => (
                    <button
                      key={t.key}
                      className={`filter-chip ${filter === t.key ? "on" : ""}`}
                      onClick={() => setFilter(t.key)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="filter-seg">
                  {TIME_FILTERS.map((t) => (
                    <button
                      key={t.key}
                      className={`filter-chip ${timeFilter === t.key ? "on" : ""}`}
                      onClick={() => setTimeFilter(t.key)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              {visibleProjects.length === 0 ? (
                <div className="posts-empty">Nema objava za izabrani filter.</div>
              ) : (
                <div className="posts-grid two">
                  {visibleProjects.map((p) => {
                    const url = mediaUrl(p.coverMediaId);
                    const Ico = FMT_ICON[p.format];
                    return (
                      <div key={p.id} className="post-tile" role="button" tabIndex={0} onClick={() => openEditor(p)}>
                        {url && (isVideoUrl(url) ? <video src={vposter(url)} muted playsInline preload="metadata" /> : <img src={url} alt="" />)}
                        <span className="post-badge">
                          <Ico /> {FORMAT_META[p.format].short}
                        </span>
                        <button className="card-del" title="Obriši" onClick={(e) => removeProject(e, p.id, p.name)}>
                          <I.Trash />
                        </button>
                        <span className="post-name">{p.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ---------- BREND ---------- */}
          {view === "brend" && (
            <div className="screen-scroll two-col">
              <div className="two-col-main">
                <div style={{ marginBottom: 24 }}>
                  <h1 className="page-title">Brend</h1>
                  <p className="page-sub">Sve što AI i predlošci koriste. Postavi jednom — važi za svaku objavu.</p>
                </div>

                <div className="brand-row">
                  <div className="brand-card logo-card">
                    <span className="brand-logo">
                      <img src="/brand/logo.png" alt="RDK" />
                    </span>
                    <div>
                      <div className="mono-label">Logo</div>
                      <b className="serif" style={{ fontSize: 17, display: "block", margin: "4px 0 10px" }}>
                        RDK · pun znak
                      </b>
                      <button className="btn btn-outline" style={{ height: 38 }}>
                        Zameni
                      </button>
                    </div>
                  </div>
                  <div className="brand-card">
                    <div className="mono-label" style={{ marginBottom: 12 }}>
                      Paleta
                    </div>
                    <div className="pal-row">
                      {PALETTE.map((c) => (
                        <div className="pal" key={c.hex}>
                          <span className="pal-sw" style={{ background: c.hex, border: c.hex === "#FAF3E4" ? "1px solid var(--line)" : "none" }} />
                          <b>{c.role}</b>
                          <i>{c.hex}</i>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mono-label sect">Font naslova</div>
                <div className="font-grid">
                  {HEADING_FONTS.map((f) => (
                    <button
                      key={f}
                      className={`font-card${brand.headingFont === f ? " on" : ""}`}
                      onClick={() => updateBrand({ headingFont: f })}
                    >
                      <b style={{ fontFamily: fontCss(f) }}>Ružini kolači</b>
                      <i>{FONTS.find((x) => x.key === f)?.label}</i>
                    </button>
                  ))}
                </div>

                <div className="mono-label sect">Font teksta</div>
                <div className="body-seg">
                  {BODY_FONTS.map((f) => (
                    <button
                      key={f}
                      className={brand.bodyFont === f ? "on" : ""}
                      style={{ fontFamily: fontCss(f) }}
                      onClick={() => updateBrand({ bodyFont: f })}
                    >
                      {FONTS.find((x) => x.key === f)?.label}
                    </button>
                  ))}
                </div>

                <div className="mono-label sect">Ton glasa — ovo čita AI</div>
                <div className="chip-wrap">
                  {brand.toneChips.map((t) => (
                    <button
                      key={t}
                      className="tone-chip"
                      onClick={() => updateBrand({ toneChips: brand.toneChips.filter((x) => x !== t) })}
                      title="Ukloni"
                    >
                      {t}
                    </button>
                  ))}
                  <button
                    className="tone-chip add"
                    onClick={() => {
                      const v = window.prompt("Nova reč za ton:");
                      if (v) updateBrand({ toneChips: [...brand.toneChips, v.trim()] });
                    }}
                  >
                    + dodaj
                  </button>
                </div>
                <textarea
                  className="txt-in"
                  rows={3}
                  style={{ marginTop: 12 }}
                  value={brand.toneText}
                  onChange={(e) => updateBrand({ toneText: e.target.value })}
                />

                <div className="brand-row" style={{ marginTop: 24 }}>
                  <div>
                    <div className="mono-label">Reči koje ne koristimo</div>
                    <div className="chip-wrap" style={{ marginTop: 10 }}>
                      {brand.bannedWords.map((w) => (
                        <button
                          key={w}
                          className="ban-chip"
                          onClick={() => updateBrand({ bannedWords: brand.bannedWords.filter((x) => x !== w) })}
                          title="Ukloni"
                        >
                          {w}
                        </button>
                      ))}
                      <button
                        className="tone-chip add"
                        onClick={() => {
                          const v = window.prompt("Reč koju AI nikad ne koristi:");
                          if (v) updateBrand({ bannedWords: [...brand.bannedWords, v.trim()] });
                        }}
                      >
                        + dodaj
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="mono-label">Hashtag setovi</div>
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 12 }}>
                      {brand.hashtagSets.map((h, i) => (
                        <div key={i}>
                          <b style={{ fontSize: 13, fontWeight: 800 }}>{h.name}</b>
                          <input
                            className="txt-in"
                            style={{ marginTop: 5, fontFamily: "ui-monospace,monospace", fontSize: 12, color: "var(--plum-700)" }}
                            value={h.tags}
                            onChange={(e) => {
                              const sets = brand.hashtagSets.slice();
                              sets[i] = { ...sets[i], tags: e.target.value };
                              updateBrand({ hashtagSets: sets });
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="toggle-row" style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid var(--line)" }}>
                  <div>
                    <b style={{ fontSize: 14 }}>Vodeni pečat sa logom</b>
                    <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3 }}>Diskretno, u donjem desnom uglu objave.</p>
                  </div>
                  <button className={`switch${brand.watermark ? " on" : ""}`} onClick={() => updateBrand({ watermark: !brand.watermark })}>
                    <i />
                  </button>
                </div>
              </div>

              <aside className="two-col-side">
                <div className="mono-label" style={{ marginBottom: 12 }}>
                  Živi pregled
                </div>
                <div className="preview-post">
                  <div className="preview-photo" style={{ backgroundImage: "url(/samples/cake-3.jpg)" }}>
                    <div className="preview-overlay">
                      <span className="gold-kicker">Subotom pečemo</span>
                      <div className="preview-title serif">Krem pita sa vanilom</div>
                    </div>
                  </div>
                  <div className="preview-cap">
                    <b>ruzini_domaci_kolaci</b>
                    <p>Tanka korica, mnogo krema, bez šećerne glazure. Piši nam do petka. Sveže rađeno samo za tebe.</p>
                  </div>
                </div>
                <p className="mono-label" style={{ marginTop: 14, lineHeight: 1.5, letterSpacing: ".08em" }}>
                  Svaka promena fonta, boje ili tona vidi se ovde pre nego što uđe u objavu.
                </p>
              </aside>
            </div>
          )}

          {/* ---------- AI PODEŠAVANJA ---------- */}
          {view === "ai" && (
            <div className="screen-scroll two-col">
              <div className="two-col-main">
                <div style={{ marginBottom: 22 }}>
                  <h1 className="page-title">AI podešavanja</h1>
                  <p className="page-sub">Ti odlučuješ koliko AI radi sam. Ništa ne ide na Instagram bez tvoje potvrde.</p>
                </div>

                <div className="quota-card">
                  <div className="quota-top">
                    <b>{aiLimited ? "LIMIT DOSTIGNUT · SAČEKAJ" : "POVEZANO · BESPLATAN NIVO"}</b>
                    <span>
                      {aiCalls} / {AI_DAILY_LIMIT} DANAS
                    </span>
                  </div>
                  <div className="quota-bar">
                    <span
                      style={{
                        width: `${Math.min(100, (aiCalls / AI_DAILY_LIMIT) * 100)}%`,
                        background: aiLimited ? "#B4453E" : undefined,
                      }}
                    />
                  </div>
                  <p>
                    Besplatni nivo: ~{AI_DAILY_LIMIT} poziva dnevno i 5 u minuti. Broji pozive koje si napravila u ovom
                    pregledaču danas. Za više — „Set up billing" u Google AI Studiju (i dalje ~besplatno na ovom obimu).
                  </p>
                </div>

                <div className="ai-cols">
                  <div>
                    <div className="mono-label sect">Brzina</div>
                    <div className="big-seg">
                      <button className={aiSet.speed === "brzi" ? "on" : ""} onClick={() => updateAi({ speed: "brzi" })}>
                        <b>BRZI</b>
                        <i>~2 s · besplatan nivo</i>
                      </button>
                      <button className={aiSet.speed === "kvalitetniji" ? "on" : ""} onClick={() => updateAi({ speed: "kvalitetniji" })}>
                        <b>KVALITETNIJI</b>
                        <i>~6 s · troši kvotu</i>
                      </button>
                    </div>
                    <div className="mono-label sect">Dužina teksta</div>
                    <div className="seg3">
                      {(["kratko", "srednje", "duže"] as const).map((v) => (
                        <button key={v} className={aiSet.textLength === v ? "on" : ""} onClick={() => updateAi({ textLength: v })}>
                          {v.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <div className="mono-label sect">Emodži</div>
                    <div className="seg3">
                      {(["bez", "najviše 1", "slobodno"] as const).map((v) => (
                        <button key={v} className={aiSet.emoji === v ? "on" : ""} onClick={() => updateAi({ emoji: v })}>
                          {v.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mono-label sect">Šta AI sme sam da radi</div>
                    {(
                      [
                        ["caption", "Piše tekst objave", "Tri verzije u tvom tonu, ti biraš."],
                        ["hashtags", "Predlaže hashtagove", "Do 5, iz tvojih najuspešnijih objava."],
                        ["timing", "Predlaže vreme objave", "Na osnovu kad tvoja publika gleda."],
                        ["backgrounds", "Generiše pozadine", "Za objave bez fotografije. Nikad ne izmišlja kolače."],
                        ["learn", "Uči iz mojih objava", "Čita 128 objava — tekst, ne fotografije."],
                      ] as [keyof AiSettings["permissions"], string, string][]
                    ).map(([key, title, desc]) => (
                      <div className="perm-row" key={key}>
                        <div>
                          <b>{title}</b>
                          <p>{desc}</p>
                        </div>
                        <button
                          className={`switch${aiSet.permissions[key] ? " on" : ""}`}
                          onClick={() => updateAi({ permissions: { ...aiSet.permissions, [key]: !aiSet.permissions[key] } })}
                        >
                          <i />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mono-label sect">Koliko unapred AI radi</div>
                <div className="auto-grid">
                  {(
                    [
                      ["cekaj", "Predloži i čekaj", "AI priprema, ti odobravaš svaku objavu."],
                      ["nedelja", "Pripremi celu nedelju", "Ponedeljkom ujutru dobiješ 5 predloga na odobrenje."],
                      ["samostalno", "Objavljuj samostalno", "Samo za formate koje si već odobrila tri puta."],
                    ] as [AiSettings["autonomy"], string, string][]
                  ).map(([key, title, desc]) => (
                    <button key={key} className={`auto-card${aiSet.autonomy === key ? " on" : ""}`} onClick={() => updateAi({ autonomy: key })}>
                      <span className="radio-dot" />
                      <b>{title}</b>
                      <p>{desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <aside className="two-col-side">
                <div className="mono-label" style={{ marginBottom: 12 }}>
                  Proba sa ovim podešavanjima
                </div>
                <button className="btn btn-primary" style={{ width: "100%" }} disabled={!!aiBusy} onClick={doTest}>
                  <I.Sparkle /> {aiBusy === "test" ? "Radim…" : "Napiši probni tekst"}
                </button>
                {aiMsg && (
                  <p className="hint" style={{ marginTop: 12 }}>
                    <I.Info /> {aiMsg}
                  </p>
                )}
                {aiTest && <div className="test-box">{aiTest}</div>}
                <p className="mono-label" style={{ marginTop: 14, lineHeight: 1.5, letterSpacing: ".08em" }}>
                  Tvoje fotografije se ne koriste za obučavanje modela.
                </p>
              </aside>
            </div>
          )}

          {/* ---------- NOVA OBJAVA ---------- */}
          {view === "nova" && (
            <div className="nova">
              <div className="nova-top">
                <h1 className="page-title" style={{ fontSize: 24 }}>
                  Nova objava
                </h1>
                <div className="nova-top-r">
                  <div className="mini-fmt">
                    {FMT_ORDER.map((k) => (
                      <button key={k} className={novaFmt === k ? "on" : ""} onClick={() => setNovaFmt(k)}>
                        {FORMAT_META[k].short}
                      </button>
                    ))}
                  </div>
                  <button className="btn btn-ghost" onClick={novaSaveDraft}>
                    <I.Check style={{ width: 15, height: 15 }} /> Sačuvaj nacrt
                  </button>
                  <button className="btn btn-outline" onClick={novaToEditor}>
                    Doradi na platnu
                  </button>
                  <button className="btn btn-primary" onClick={() => showToast("Objava — Instagram povezivanje je sledeći korak")}>
                    Objavi
                  </button>
                </div>
              </div>

              <div className="nova-cols">
                <div className="nova-photos">
                  <div className="mono-label">Fotke · izabrano {novaPhotos.length}</div>
                  <div className="np-grid">
                    {media
                      .filter((m) => m.kind === "image")
                      .map((m) => {
                        const idx = novaPhotos.indexOf(m.id);
                        return (
                          <button key={m.id} className={`np-tile${idx >= 0 ? " on" : ""}`} onClick={() => togglePhoto(m.id)}>
                            <img src={m.url} alt="" />
                            {idx >= 0 && <span className="np-badge">{idx + 1}</span>}
                          </button>
                        );
                      })}
                  </div>
                </div>

                <div className="nova-preview">
                  <div className="preview-post" style={{ width: "100%", maxWidth: 360 }}>
                    <div
                      className="preview-photo"
                      style={{ backgroundImage: mediaUrl(novaPhotos[0]) ? `url(${mediaUrl(novaPhotos[0])})` : undefined }}
                    >
                      <div className="preview-overlay">
                        <span className="gold-kicker">Novo ove nedelje</span>
                        <div className="preview-title serif">{(novaTopic.split(",")[0] || "Nova objava").trim()}</div>
                      </div>
                    </div>
                    <div className="preview-cap">
                      <b>ruzini_domaci_kolaci</b>
                      <p>{novaCaps[novaCapIdx]?.text || "Klikni „Neka AI napiše” za opis objave."}</p>
                    </div>
                  </div>
                </div>

                <div className="nova-text">
                  <div className="mono-label" style={{ marginBottom: 10 }}>
                    Tekst
                  </div>
                  <input
                    className="txt-in"
                    value={novaTopic}
                    onChange={(e) => setNovaTopic(e.target.value)}
                    placeholder="npr. torta od malina, naručuje se do petka"
                  />
                  <button className="btn btn-primary" style={{ width: "100%", marginTop: 12 }} disabled={!!aiBusy} onClick={doNovaCaptions}>
                    <I.Sparkle /> {aiBusy === "captions3" ? "AI piše…" : "Neka AI napiše"}
                  </button>
                  {aiMsg && (
                    <p className="hint" style={{ marginTop: 12 }}>
                      <I.Info /> {aiMsg}
                    </p>
                  )}
                  <div className="cap-list">
                    {novaCaps.map((c, i) => (
                      <button key={i} className={`cap-card${i === novaCapIdx ? " on" : ""}`} onClick={() => setNovaCapIdx(i)}>
                        <span className="radio-dot" />
                        <span>
                          <span className="mono-label">{c.kicker}</span>
                          <p>{c.text}</p>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---------- DNEVNIK (LOG) ---------- */}
          {view === "log" && (
            <div className="screen-scroll home">
              <div className="home-head">
                <div>
                  <h1 className="page-title">Dnevnik</h1>
                  <p className="page-sub">Šta se dešavalo u Studiju — jednostavno, bez tehničkih izraza.</p>
                </div>
                {logItems.length > 0 && (
                  <button className="btn btn-outline" onClick={() => clearLog()}>
                    Obriši dnevnik
                  </button>
                )}
              </div>
              {logItems.length === 0 ? (
                <div className="posts-empty">Još nema zabeleženih događaja. Kad izvezeš objavu, ovde piše šta se desilo.</div>
              ) : (
                <div className="log-list">
                  {logItems.map((e) => (
                    <div key={e.id} className={`log-row log-${e.kind}`}>
                      <span className="log-ico" aria-hidden>
                        {e.kind === "ok" ? <I.Check /> : e.kind === "error" ? "!" : e.kind === "warn" ? "!" : <I.Info />}
                      </span>
                      <div className="log-body">
                        <b>{e.title}</b>
                        {e.detail && <p>{e.detail}</p>}
                        <span className="log-when">{formatWhen(e.t)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

      {/* ===== EDITOR ===== */}
      {view === "editor" && project && slide && fmt && (
        <section className="view">
          <div className="editor">
            <div className="ed-bar">
              <button className="icon-btn" title="Nazad" onClick={() => setView("studio")}>
                <I.Back />
              </button>
              <span className="ed-kicker serif">Platno ·</span>
              <input
                className="ed-name"
                value={project.name}
                spellCheck={false}
                onChange={(e) => setProject({ ...project, name: e.target.value })}
              />
              <span className="fmt-badge">
                {(() => {
                  const Ico = FMT_ICON[project.format];
                  return <Ico />;
                })()}
                {fmt.label}
              </span>
              <div className="topbar-spacer" />
              <button className="btn btn-ghost desktop-only" onClick={() => save(false)}>
                Sačuvaj nacrt
              </button>
              {!wizard && (
                <button className="btn btn-primary ed-export" onClick={runExport} disabled={!!exportUI}>
                  <I.Export /> {exportUI ? "Izvozim…" : "Izvezi"}
                </button>
              )}
            </div>

            <div className={`ed-body${wizard ? " wizard" : ""}`}>
              <div className={`sheet-backdrop${sheet ? " on" : ""}`} onClick={() => setSheet(null)} />

              {/* LEFT: tool rail (desktop) / korak-zaglavlje (mobilni vođeni tok) */}
              {wizard ? (
                <div className="wiz-head">
                  <div className="wiz-dots">
                    {wizSteps.map((s, i) => (
                      <span key={s.key} className={`wiz-dot${i === wizStep ? " on" : ""}${i < wizStep ? " done" : ""}`} />
                    ))}
                  </div>
                  <div className="wiz-title">
                    <span className="wiz-count">
                      Korak {wizStep + 1} / {wizSteps.length}
                    </span>
                    <b>{wizSteps[wizStep]?.label}</b>
                  </div>
                </div>
              ) : (
                <nav className="tool-rail">
                  {(
                    [
                      ["foto", "FOTO", I.ImgIcon],
                      ["text", "TEKST", I.TextIcon],
                      ["brend", "BREND", I.Brand],
                      ["red", "RED", I.Layers],
                      ["ai", "AI", I.Sparkle],
                    ] as [typeof propTab, string, React.FC<React.SVGProps<SVGSVGElement>>][]
                  ).map(([key, label, Ico]) => (
                    <button
                      key={key}
                      className={`tool-btn${propTab === key ? " on" : ""}${key === "ai" ? " ai" : ""}`}
                      onClick={() => setPropTab(key)}
                    >
                      <Ico />
                      {label}
                    </button>
                  ))}
                </nav>
              )}

              {/* CENTER: stage */}
              <div className="stage">
                {!wizard && (
                <div className="stage-top">
                  {FMT_ORDER.map((k) => {
                    const Ico = FMT_ICON[k];
                    return (
                      <button
                        key={k}
                        className={`fmt-chip${project.format === k ? " on" : ""}`}
                        onClick={() => setProject({ ...project, format: k })}
                      >
                        <Ico /> {FORMAT_META[k].short}
                      </button>
                    );
                  })}
                  <button className={`fmt-chip${previewing ? " on" : ""}`} onClick={playPreview} title="Pregledaj animaciju">
                    <I.Play style={{ width: 13, height: 13 }} /> Pregled
                  </button>
                  <button
                    className={`fmt-chip${propTab === "safe" ? " on" : ""}`}
                    onClick={() => {
                      setSelId(null);
                      setSafeZone(true);
                      setPropTab("safe");
                      if (window.innerWidth <= 760) document.querySelector(".panel-r")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    title="Bezbedna zona — margine i šta upada u zonu"
                  >
                    <I.Frame style={{ width: 13, height: 13 }} /> Safe zone
                  </button>
                  <button
                    className="fmt-chip fmt-chip-ai"
                    onClick={() => {
                      setPropTab("ai");
                      if (window.innerWidth <= 760) setSheet("props");
                    }}
                    title="AI pomoć"
                  >
                    <I.Sparkle style={{ width: 13, height: 13 }} /> AI pomoć
                  </button>
                </div>
                )}

                <div className="canvas-wrap">
                  <div
                    ref={canvasRef}
                    className="canvas"
                    style={{
                      aspectRatio: fmt.ratio,
                      ...(fmt.ratio === "9 / 16"
                        ? { height: "min(72vh,560px)", width: "auto" }
                        : { width: "min(94%,440px)", height: "auto" }),
                    }}
                    onPointerDown={(e) => {
                      if ((e.target as HTMLElement).closest(".ov")) return;
                      setSelId(null);
                      startBgPan(e);
                    }}
                  >
                    <div
                      className="fx"
                      key={`fx-${animKey}`}
                      style={
                        previewing && project.transition !== "none"
                          ? { animation: `${project.transition === "slide" ? "fxSlideIn" : "fxFadeIn"} .5s ease both` }
                          : undefined
                      }
                    >
                      {mediaUrl(slide.mediaId) ? (
                        isVideoUrl(mediaUrl(slide.mediaId)) ? (
                          <video
                            className="bg"
                            ref={bgVideoRef}
                            src={mediaUrl(slide.mediaId)!}
                            muted
                            playsInline
                            loop
                            preload="auto"
                            draggable={false}
                            onPlay={() => setVidPlaying(true)}
                            onPause={() => setVidPlaying(false)}
                            style={{
                              objectPosition: `${slide.focus.x}% ${slide.focus.y}%`,
                              transform: `scale(${slide.zoom})`,
                              transformOrigin: `${slide.focus.x}% ${slide.focus.y}%`,
                              cursor: slide.zoom > 1 ? "grab" : "default",
                            }}
                          />
                        ) : (
                          <img
                            className="bg"
                            src={mediaUrl(slide.mediaId)!}
                            alt=""
                            draggable={false}
                            style={{
                              objectPosition: `${slide.focus.x}% ${slide.focus.y}%`,
                              transform: `scale(${slide.zoom})`,
                              transformOrigin: `${slide.focus.x}% ${slide.focus.y}%`,
                              cursor: slide.zoom > 1 ? "grab" : "default",
                            }}
                          />
                        )
                      ) : (
                        <div className="empty">
                          <I.ImgIcon />
                          <b>Dodaj sliku ili video</b>
                          <span>{wizard ? "Iz galerije ili kamerom — ispod" : "Klikni na medij levo da započneš dizajn"}</span>
                        </div>
                      )}
                      <div className="scrim" style={{ opacity: slide.mediaId ? slide.scrim / 100 : 0 }} />
                      {fmt.story && (
                        <div className="ig-bars">
                          <i className="a" />
                          <i />
                          <i />
                        </div>
                      )}
                      {fmt.story && project.chrome && (
                        <div className="ig-top">
                          <span className="dot" />
                          <span className="nm">ruzini_kolaci</span>
                        </div>
                      )}
                    </div>

                    {isVideoUrl(mediaUrl(slide.mediaId)) && (
                      <button
                        className={`vid-play${vidPlaying ? " playing" : ""}`}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          const v = bgVideoRef.current;
                          if (!v) return;
                          if (v.paused) v.play().catch(() => {});
                          else v.pause();
                        }}
                        title={vidPlaying ? "Pauza" : "Pusti video"}
                      >
                        {vidPlaying ? <I.Pause /> : <I.Play />}
                      </button>
                    )}

                    {slide.mediaId && (
                      <>
                        {slide.texts.map((t, i) => (
                          <div
                            key={`${t.id}-${animKey}`}
                            className={`ov${selId === t.id ? " sel" : ""}`}
                            style={{
                              left: `${t.pos.x}%`,
                              top: `${t.pos.y}%`,
                              textAlign: t.align,
                              ...textAnimStyle(0.12 + i * 0.08),
                            }}
                            onPointerDown={(e) => startDrag({ kind: "text", id: t.id }, e)}
                          >
                            <div
                              className="ov-text"
                              style={{
                                fontFamily: fontCss(t.font),
                                fontSize: t.size,
                                color: t.color,
                                fontWeight: t.bold ? 700 : 500,
                              }}
                            >
                              {t.content}
                            </div>
                          </div>
                        ))}

                        {safeZone && (
                          <div
                            className="safezone"
                            style={{
                              left: `${curSafe.left * 100}%`,
                              top: `${curSafe.top * 100}%`,
                              right: `${curSafe.right * 100}%`,
                              bottom: `${curSafe.bottom * 100}%`,
                            }}
                          >
                            <span className="safezone-tag">Safe zone</span>
                          </div>
                        )}

                        {slide.cta && (
                          <div
                            key={`cta-${animKey}`}
                            className={`ov${selId === "cta" ? " sel" : ""}`}
                            style={{ left: `${slide.ctaPos.x}%`, top: `${slide.ctaPos.y}%`, ...textAnimStyle(0.28) }}
                            onPointerDown={(e) => startDrag({ kind: "cta" }, e)}
                          >
                            <span className={`ov-cta ${slide.ctaStyle}`}>
                              {slide.ctaText} <I.Arrow />
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {(fmt.multi || (wizard && project.slides.length > 1)) && (
                  <div className="carousel">
                    <span className="carousel-label">
                      {fmt.slideLabel} {active + 1}/{project.slides.length}
                    </span>
                    <div style={{ display: "flex", gap: 10 }}>
                      {project.slides.map((sl, i) => {
                        const u = mediaUrl(sl.mediaId);
                        return (
                          <button
                            key={sl.id}
                            className={`slide-thumb${i === active ? " on" : ""}`}
                            onClick={() => {
                              setActive(i);
                              setSelId(null);
                            }}
                          >
                            <span className="n">{i + 1}</span>
                            {u && (isVideoUrl(u) ? <video src={vposter(u)} muted playsInline preload="metadata" /> : <img src={u} alt="" />)}
                          </button>
                        );
                      })}
                    </div>
                    {!wizard && (
                      <button className="add-slide" onClick={addSlide} title={`Dodaj ${fmt.slideLabel.toLowerCase()}`}>
                        <I.Plus />
                      </button>
                    )}
                    {project.slides.length > 1 && (
                      <button
                        className="add-slide"
                        onClick={deleteSlide}
                        title="Obriši trenutni slajd"
                        style={{ borderStyle: "solid", color: "var(--muted)" }}
                      >
                        <I.Trash />
                      </button>
                    )}
                    <span style={{ flex: 1 }} />
                    {!wizard && (
                      <select
                        className="mini-select"
                        value={project.transition}
                        onChange={(e) => setProject({ ...project, transition: e.target.value as Project["transition"] })}
                        title="Prelaz između slajdova"
                      >
                        <option value="none">Prelaz: bez</option>
                        <option value="fade">Prelaz: pretapanje</option>
                        <option value="slide">Prelaz: klizanje</option>
                      </select>
                    )}
                  </div>
                )}
              </div>

              {/* RIGHT: properties */}
              <aside className={`panel panel-r${sheet === "props" ? " open" : ""}`}>
                <div className="panel-h">
                  Svojstva
                  <button className="sheet-close" onClick={() => setSheet(null)}>
                    <I.Close />
                  </button>
                </div>
                <div className="panel-scroll">
                  {/* ===== VOĐENI TOK — opis (caption) + AI, iznad teksta na slici ===== */}
                  {wizard && stepKey === "text" && (
                    <>
                      <div className="field">
                        <label>Opis objave (caption)</label>
                        <textarea
                          className="txt-in"
                          style={{ minHeight: 84, resize: "vertical", paddingTop: 10 }}
                          value={project.caption ?? ""}
                          onChange={(e) => setProject({ ...project, caption: e.target.value })}
                          placeholder="Napiši par reči o objavi (ili pusti AI da predloži)…"
                        />
                        <button className="btn btn-primary" style={{ width: "100%", marginTop: 10 }} disabled={!!aiBusy} onClick={doWizCaption}>
                          <I.Sparkle /> {aiBusy === "captions3" ? "AI piše…" : "AI predlog opisa"}
                        </button>
                        {aiMsg && (
                          <p className="hint" style={{ marginTop: 10 }}>
                            <I.Info /> {aiMsg}
                          </p>
                        )}
                        {wizCaps.length > 0 && (
                          <div className="cap-list">
                            {wizCaps.map((c, i) => (
                              <button
                                key={i}
                                className={`cap-card${project.caption === c.text ? " on" : ""}`}
                                onClick={() => setProject({ ...project, caption: c.text })}
                              >
                                <span className="radio-dot" />
                                <span>
                                  <span className="mono-label">{c.kicker}</span>
                                  <p>{c.text}</p>
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="divide" />
                      <div className="mono-label" style={{ marginBottom: 8 }}>
                        Tekst preko slike (nije obavezno)
                      </div>
                    </>
                  )}

                  {/* ===== VOĐENI TOK — Slike i video (telefon: Galerija / Kamera) ===== */}
                  {wizard && stepKey === "media" && (
                    <>
                      {/* zum — odmah ispod slike */}
                      {slide.mediaId && (
                        <>
                          <div className="field">
                            <label>Zoom</label>
                            <div className="range-row">
                              <input
                                type="range"
                                className="range"
                                min={100}
                                max={300}
                                value={Math.round(slide.zoom * 100)}
                                onChange={(e) => patchSlide({ zoom: +e.target.value / 100 })}
                              />
                              <span className="range-val">{Math.round(slide.zoom * 100)}%</span>
                            </div>
                            <button className="chip" style={{ marginTop: 10 }} onClick={() => patchSlide({ zoom: 1, focus: { x: 50, y: 50 } })}>
                              Resetuj kadar
                            </button>
                            <p className="hint" style={{ marginTop: 10 }}>
                              <I.Info /> Prevuci sliku po platnu da je pomeriš, zumom je uvećaj.
                            </p>
                          </div>
                          <div className="divide" />
                        </>
                      )}

                      {/* dodavanje medija sa telefona */}
                      <div className="field">
                        <label>Dodaj medij</label>
                        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => galleryRef.current?.click()}>
                            <I.ImgIcon style={{ width: 16, height: 16 }} /> Iz galerije
                          </button>
                          <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => cameraRef.current?.click()}>
                            <I.Camera style={{ width: 16, height: 16 }} /> Kamera
                          </button>
                        </div>
                        <input ref={galleryRef} type="file" accept="image/*,video/*" multiple hidden onChange={onWizUpload} />
                        <input ref={cameraRef} type="file" accept="image/*,video/*" capture="environment" hidden onChange={onWizUpload} />
                        <p className="hint" style={{ marginTop: 10 }}>
                          <I.Info /> Izaberi iz Photos galerije ili slikaj/snimaj kamerom. Možeš dodati više — svaka postaje strana.
                        </p>
                      </div>

                      {/* ranije korišćeno (bez uzoraka) — za ponovno korišćenje + brisanje */}
                      {(() => {
                        const mine = media.filter((m) => !m.url.startsWith("/samples"));
                        if (mine.length === 0) return null;
                        return (
                          <>
                            <div className="divide" />
                            <div className="mono-label" style={{ marginBottom: 8 }}>
                              Ranije korišćeno
                            </div>
                            <div className="media-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                              {mine.map((m) => {
                                const idx = slideIndexForMedia(m.id);
                                return (
                                  <div key={m.id} className={`media-tile${idx >= 0 ? " sel" : ""}`} role="button" tabIndex={0} onClick={() => wizToggleMedia(m.id)}>
                                    {isVideoUrl(m.url) ? <video src={vposter(m.url)} muted playsInline preload="metadata" /> : <img src={m.url} alt={m.name} />}
                                    {m.kind === "video" && (
                                      <span className="vtag">
                                        <I.Play />
                                      </span>
                                    )}
                                    {idx >= 0 && <span className="np-badge">{idx + 1}</span>}
                                    <button className="card-del" title="Obriši medij" onClick={(e) => removeMedia(e, m)}>
                                      <I.Trash />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        );
                      })()}
                    </>
                  )}

                  {/* ===== VOĐENI TOK — koraci Izgled / Animacija / Sačuvaj ===== */}
                  {wizard && stepKey === "look" && (
                    <>
                      <div className="mono-label" style={{ marginBottom: 4 }}>
                        Font naslova
                      </div>
                      <div className="font-grid">
                        {HEADING_FONTS.map((f) => (
                          <button key={f} className={`font-card${brand.headingFont === f ? " on" : ""}`} onClick={() => updateBrand({ headingFont: f })}>
                            <b style={{ fontFamily: fontCss(f) }}>Ružini kolači</b>
                            <i>{FONTS.find((x) => x.key === f)?.label}</i>
                          </button>
                        ))}
                      </div>
                      <div className="mono-label sect" style={{ margin: "16px 0 6px" }}>
                        Font teksta
                      </div>
                      <div className="body-seg">
                        {BODY_FONTS.map((f) => (
                          <button key={f} className={brand.bodyFont === f ? "on" : ""} style={{ fontFamily: fontCss(f) }} onClick={() => updateBrand({ bodyFont: f })}>
                            {FONTS.find((x) => x.key === f)?.label}
                          </button>
                        ))}
                      </div>
                      <p className="hint" style={{ marginTop: 14 }}>
                        <I.Info /> Boje i ton se podešavaju u Brendu — važe za sve objave.
                      </p>
                    </>
                  )}

                  {wizard && stepKey === "anim" && (
                    <>
                      <div className="field">
                        <label>Prelaz između strana</label>
                        <div className="wiz-opts">
                          {(
                            [
                              ["none", "Bez prelaza"],
                              ["fade", "Pretapanje"],
                              ["slide", "Klizanje"],
                            ] as [Project["transition"], string][]
                          ).map(([v, lbl]) => (
                            <button key={v} className={`wiz-opt${project.transition === v ? " on" : ""}`} onClick={() => setProject({ ...project, transition: v })}>
                              {lbl}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="divide" />
                      <div className="field">
                        <label>Animacija teksta</label>
                        <div className="wiz-opts">
                          {(
                            [
                              ["none", "Bez"],
                              ["fade", "Pojavljivanje"],
                              ["rise", "Izranjanje"],
                            ] as [Project["textAnim"], string][]
                          ).map(([v, lbl]) => (
                            <button key={v} className={`wiz-opt${project.textAnim === v ? " on" : ""}`} onClick={() => setProject({ ...project, textAnim: v })}>
                              {lbl}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button className="btn btn-outline" style={{ width: "100%", marginTop: 14 }} onClick={playPreview}>
                        <I.Play style={{ width: 15, height: 15 }} /> Pregledaj
                      </button>
                    </>
                  )}

                  {wizard && stepKey === "done" && (
                    <>
                      <div className="field">
                        <label>Pregled pre čuvanja</label>
                        <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginTop: 4 }}>
                          {project.slides.filter((s) => s.mediaId).length || 0}{" "}
                          {project.slides.filter((s) => s.mediaId).length === 1 ? "strana" : "strane/strana"} · {fmt.short}
                          {project.caption ? " · ima opis" : ""}.
                        </p>
                      </div>
                      {project.caption ? (
                        <div className="field">
                          <label>Opis objave</label>
                          <p style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.5, background: "var(--cream-2)", border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", whiteSpace: "pre-wrap" }}>
                            {project.caption}
                          </p>
                        </div>
                      ) : null}
                      <p className="hint" style={{ marginTop: 12 }}>
                        <I.Info /> Tapni „Sačuvaj u Photos" dole da objava ode u galeriju.
                      </p>
                      <button className="btn btn-ghost" style={{ width: "100%", marginTop: 12 }} onClick={() => save(false)}>
                        <I.Check style={{ width: 15, height: 15 }} /> Sačuvaj kao nacrt
                      </button>
                    </>
                  )}

                  {/* brza provera bezbedne zone uz korak Tekst */}
                  {wizard && stepKey === "text" && (() => {
                    const outCount =
                      slide.texts.filter((t) => outsideSafe(t.pos.x, t.pos.y)).length +
                      (slide.cta && outsideSafe(slide.ctaPos.x, slide.ctaPos.y) ? 1 : 0);
                    return (
                      <>
                        <div className="divide" />
                        <div className="toggle-row">
                          <b style={{ fontWeight: 500, fontSize: 13.5 }}>Prikaži bezbednu zonu</b>
                          <button className={`switch${safeZone ? " on" : ""}`} onClick={() => setSafeZone((v) => !v)}>
                            <i />
                          </button>
                        </div>
                        {outCount > 0 ? (
                          <div className="safe-viol" style={{ marginTop: 10 }}>
                            <span className="safe-viol-name">{outCount} van bezbedne zone</span>
                            <button
                              className="btn btn-outline"
                              style={{ height: 32, padding: "0 12px", fontSize: 11.5 }}
                              onClick={() => {
                                slide.texts.forEach((t) => {
                                  if (outsideSafe(t.pos.x, t.pos.y)) patchText(t.id, { pos: clampSafe(t.pos) });
                                });
                                if (slide.cta && outsideSafe(slide.ctaPos.x, slide.ctaPos.y)) patchSlide({ ctaPos: clampSafe(slide.ctaPos) });
                              }}
                            >
                              Uvuci sve
                            </button>
                          </div>
                        ) : (
                          <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 8 }}>Sve je unutar bezbedne zone. 👍</p>
                        )}
                      </>
                    );
                  })()}

                  {/* ---- SAFE ZONE (margine) ---- */}
                  {propTab === "safe" && (
                    <>
                      <div className="field">
                        <label>Bezbedna zona</label>
                        <p style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5, marginTop: 4 }}>
                          Instagram i TikTok preko ivica objave prikazuju svoj interfejs (nalog, opis, dugmad). Drži važan
                          tekst i CTA unutar isprekidane linije da ih ništa ne prekrije.
                        </p>
                      </div>
                      <div className="toggle-row" style={{ marginTop: 4 }}>
                        <b style={{ fontWeight: 500, fontSize: 13.5 }}>Prikaži vodič na platnu</b>
                        <button className={`switch${safeZone ? " on" : ""}`} onClick={() => setSafeZone((v) => !v)}>
                          <i />
                        </button>
                      </div>
                      <div className="divide" />
                      <div className="field">
                        <label>Margine — koliko čuvamo od ivice</label>
                        {(
                          [
                            ["top", "Gore"],
                            ["bottom", "Dole"],
                            ["left", "Levo"],
                            ["right", "Desno"],
                          ] as ["top" | "bottom" | "left" | "right", string][]
                        ).map(([edge, lbl]) => (
                          <div className="range-row" key={edge} style={{ marginTop: 8 }}>
                            <span style={{ width: 46, fontSize: 12.5, color: "var(--muted)", flex: "0 0 46px" }}>{lbl}</span>
                            <input
                              type="range"
                              className="range"
                              min={0}
                              max={30}
                              value={Math.round(curSafe[edge] * 100)}
                              onChange={(e) => setSafeInset(edge, +e.target.value / 100)}
                            />
                            <span className="range-val">{Math.round(curSafe[edge] * 100)}%</span>
                          </div>
                        ))}
                        <button className="btn btn-text" style={{ marginTop: 10, padding: 0 }} onClick={resetSafe}>
                          Vrati podrazumevane margine
                        </button>
                      </div>
                      <div className="divide" />
                      <div className="field">
                        <label>Šta upada u zonu</label>
                        {(() => {
                          const viols: { key: string; label: string; fix: () => void }[] = [];
                          slide.texts.forEach((t, i) => {
                            if (outsideSafe(t.pos.x, t.pos.y))
                              viols.push({
                                key: t.id,
                                label: `Tekst ${i + 1}${t.content ? ` · „${t.content.slice(0, 18)}${t.content.length > 18 ? "…" : ""}"` : ""}`,
                                fix: () => patchText(t.id, { pos: clampSafe(t.pos) }),
                              });
                          });
                          if (slide.cta && outsideSafe(slide.ctaPos.x, slide.ctaPos.y))
                            viols.push({
                              key: "cta",
                              label: `Dugme · „${slide.ctaText}"`,
                              fix: () => patchSlide({ ctaPos: clampSafe(slide.ctaPos) }),
                            });
                          if (viols.length === 0)
                            return (
                              <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 8, lineHeight: 1.5 }}>
                                Sve je unutar bezbedne zone. 👍
                              </p>
                            );
                          return (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                              {viols.map((v) => (
                                <div key={v.key} className="safe-viol">
                                  <span className="safe-viol-name">{v.label}</span>
                                  <button className="btn btn-outline" style={{ height: 32, padding: "0 12px", fontSize: 11.5 }} onClick={v.fix}>
                                    Uvuci unutra
                                  </button>
                                </div>
                              ))}
                              <button
                                className="btn btn-text"
                                style={{ padding: 0, alignSelf: "flex-start" }}
                                onClick={() => {
                                  slide.texts.forEach((t) => {
                                    if (outsideSafe(t.pos.x, t.pos.y)) patchText(t.id, { pos: clampSafe(t.pos) });
                                  });
                                  if (slide.cta && outsideSafe(slide.ctaPos.x, slide.ctaPos.y)) patchSlide({ ctaPos: clampSafe(slide.ctaPos) });
                                }}
                              >
                                Uvuci sve unutra
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    </>
                  )}

                  {/* ---- FOTO (media + slika) ---- */}
                  {propTab === "foto" && (
                    <>
                      <div className="media-tabs" style={{ padding: "0 0 12px" }}>
                        <button className={`chip${mediaType === "image" ? " on" : ""}`} onClick={() => setMediaType("image")}>
                          Slike
                        </button>
                        <button className={`chip${mediaType === "video" ? " on" : ""}`} onClick={() => setMediaType("video")}>
                          Video
                        </button>
                      </div>
                      <div className="media-grid">
                        <button className="upload-tile" onClick={() => fileRef.current?.click()}>
                          <I.Upload />
                          Otpremi svoju
                        </button>
                        {media
                          .filter((m) => m.kind === mediaType)
                          .map((m) => (
                            <button key={m.id} className={`media-tile${slide.mediaId === m.id ? " sel" : ""}`} onClick={() => pickMedia(m.id)}>
                              {isVideoUrl(m.url) ? (
                                <video src={vposter(m.url)} muted playsInline preload="metadata" />
                              ) : (
                                <img src={m.url} alt={m.name} />
                              )}
                              {m.kind === "video" && (
                                <span className="vtag">
                                  <I.Play />
                                </span>
                              )}
                            </button>
                          ))}
                      </div>
                      <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={onUpload} />
                      <div className="divide" />
                    </>
                  )}

                  {/* ---- BREND (font/boje se menjaju u Brendu) ---- */}
                  {propTab === "brend" && (
                    <>
                      <div className="field">
                        <label>Font naslova</label>
                        <div className="txt-in" style={{ display: "flex", alignItems: "center" }}>
                          {FONTS.find((f) => f.key === brand.headingFont)?.label} · 500
                        </div>
                        <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 8, lineHeight: 1.5 }}>
                          Font, boje i ton se menjaju u <b>Brendu</b> — važi za sve objave.
                        </p>
                      </div>
                      <button className="btn btn-outline" style={{ width: "100%" }} onClick={() => setView("brend")}>
                        Otvori Brend
                      </button>
                    </>
                  )}

                  {/* ---- RED (slajdovi/strane) ---- */}
                  {propTab === "red" && (
                    <>
                      {fmt.multi ? (
                        <>
                          <button className="btn btn-primary" style={{ width: "100%", marginBottom: 14 }} onClick={addSlide}>
                            <I.Plus /> Dodaj {fmt.slideLabel.toLowerCase()}
                          </button>
                          <div className="field">
                            <label>{fmt.slideLabel} ({project.slides.length})</label>
                            {project.slides.map((sl, i) => {
                              const u = mediaUrl(sl.mediaId);
                              return (
                                <div key={sl.id} className={`layer-item${i === active ? " on" : ""}`} onClick={() => { setActive(i); setSelId(null); }}>
                                  <span className="red-thumb">{u ? (isVideoUrl(u) ? <video src={vposter(u)} muted playsInline preload="metadata" /> : <img src={u} alt="" />) : null}</span>
                                  <span className="layer-name">
                                    {fmt.slideLabel} {i + 1}
                                  </span>
                                  {project.slides.length > 1 && (
                                    <button
                                      className="layer-del"
                                      title="Obriši"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActive(i);
                                        setTimeout(deleteSlide, 0);
                                      }}
                                    >
                                      <I.Trash />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <p className="hint">
                          <I.Info /> Ovaj format ({fmt.short}) ima jednu stranu. Story, Reels i Carousel dozvoljavaju više.
                        </p>
                      )}
                    </>
                  )}

                  {/* ---- TEXT ---- */}
                  {propTab === "text" && (
                    <>
                      <button className="btn btn-primary" style={{ width: "100%", marginBottom: 14 }} onClick={addText}>
                        <I.Plus /> Dodaj tekst
                      </button>

                      <div className="field">
                        <label>Slojevi teksta</label>
                        {slide.texts.length === 0 && (
                          <p style={{ fontSize: 12.5, color: "var(--muted)" }}>Nema teksta. Dodaj novi tekst iznad.</p>
                        )}
                        {slide.texts.map((t) => (
                          <div key={t.id} className={`layer-item${selId === t.id ? " on" : ""}`} onClick={() => setSelId(t.id)}>
                            <I.TextIcon style={{ width: 15, height: 15, flex: "0 0 15px" }} />
                            <span className="layer-name">{t.content || "Prazan tekst"}</span>
                            <button
                              className="layer-del"
                              title="Obriši tekst"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteText(t.id);
                              }}
                            >
                              <I.Trash />
                            </button>
                          </div>
                        ))}
                      </div>

                      {selText ? (
                        <>
                          <div className="divide" />
                          <div className="field">
                            <label>Sadržaj</label>
                            <textarea
                              className="txt-in"
                              rows={3}
                              value={selText.content}
                              onChange={(e) => patchText(selText.id, { content: e.target.value })}
                            />
                          </div>
                          <div className="field">
                            <label>Font</label>
                            <select
                              className="mini-select"
                              style={{ width: "100%", height: 42 }}
                              value={selText.font}
                              onChange={(e) => patchText(selText.id, { font: e.target.value })}
                            >
                              {FONTS.map((f) => (
                                <option key={f.key} value={f.key}>
                                  {f.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="field">
                            <label>Veličina</label>
                            <div className="range-row">
                              <input
                                type="range"
                                className="range"
                                min={12}
                                max={80}
                                value={selText.size}
                                onChange={(e) => patchText(selText.id, { size: +e.target.value })}
                              />
                              <span className="range-val">{selText.size} px</span>
                            </div>
                          </div>
                          <div className="field">
                            <label>Poravnanje i stil</label>
                            <div className="seg-2">
                              {(
                                [
                                  ["left", I.AlignLeft],
                                  ["center", I.AlignCenter],
                                  ["right", I.AlignRight],
                                ] as [Align, React.FC<React.SVGProps<SVGSVGElement>>][]
                              ).map(([a, Ico]) => (
                                <button
                                  key={a}
                                  className={selText.align === a ? "on" : ""}
                                  onClick={() => patchText(selText.id, { align: a })}
                                >
                                  <Ico />
                                </button>
                              ))}
                              <button
                                className={selText.bold ? "on" : ""}
                                style={{ fontWeight: 800 }}
                                onClick={() => patchText(selText.id, { bold: !selText.bold })}
                                title="Podebljano"
                              >
                                B
                              </button>
                            </div>
                          </div>
                          <div className="field">
                            <label>Boja teksta</label>
                            <div className="swatches">
                              {TEXT_COLORS.map((c) => (
                                <button
                                  key={c}
                                  className={`sw${selText.color === c ? " on" : ""}`}
                                  style={{ background: c }}
                                  onClick={() => patchText(selText.id, { color: c })}
                                />
                              ))}
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="hint">
                          <I.Info /> Izaberi tekst iz liste (ili klikni na njega na platnu) da mu menjaš font,
                          veličinu, boju i poziciju.
                        </p>
                      )}

                      <div className="divide" />
                      <div className="field">
                        <label>Animacija teksta (u pregledu)</label>
                        <select
                          className="mini-select"
                          style={{ width: "100%", height: 42 }}
                          value={project.textAnim}
                          onChange={(e) => setProject({ ...project, textAnim: e.target.value as Project["textAnim"] })}
                        >
                          <option value="none">Bez animacije</option>
                          <option value="fade">Pretapanje (fade)</option>
                          <option value="rise">Iskakanje (rise)</option>
                        </select>
                        <button
                          className="chip"
                          style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
                          onClick={playPreview}
                        >
                          <I.Play style={{ width: 12, height: 12 }} /> Pregledaj animaciju
                        </button>
                      </div>
                    </>
                  )}

                  {/* ---- CTA (u okviru Teksta) ---- */}
                  {propTab === "text" && (
                    <>
                      <div className="divide" />
                      <div className="mono-label" style={{ margin: "0 0 12px" }}>
                        CTA dugme
                      </div>
                      <div className="toggle-row">
                        <b>Prikaži CTA dugme</b>
                        <button className={`switch${slide.cta ? " on" : ""}`} onClick={() => patchSlide({ cta: !slide.cta })}>
                          <i />
                        </button>
                      </div>
                      <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 16, lineHeight: 1.5 }}>
                        Poziv na akciju — npr. „Naruči", „Poruči preko DM-a", „Saznaj više".
                      </p>
                      <div className="field">
                        <label>Tekst dugmeta</label>
                        <input className="txt-in" value={slide.ctaText} onChange={(e) => patchSlide({ ctaText: e.target.value })} />
                      </div>
                      <div className="field">
                        <label>Brzi predlozi</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {["Naruči", "Poruči u DM", "Saznaj više", "Rezerviši"].map((t) => (
                            <button key={t} className="chip" onClick={() => patchSlide({ ctaText: t })}>
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="divide" />
                      <div className="field">
                        <label>Stil dugmeta</label>
                        <div className="seg-2">
                          {(
                            [
                              ["cta-fill", "Zlatno"],
                              ["cta-solid", "Ljubičasto"],
                              ["cta-outline", "Obris"],
                            ] as [CtaStyle, string][]
                          ).map(([cs, label]) => (
                            <button key={cs} className={slide.ctaStyle === cs ? "on" : ""} onClick={() => patchSlide({ ctaStyle: cs })}>
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* ---- SLIKA (u okviru Foto) ---- */}
                  {propTab === "foto" && slide.mediaId && (
                    <>
                      <div className="field">
                        <label>Zum slike</label>
                        <div className="range-row">
                          <input
                            type="range"
                            className="range"
                            min={100}
                            max={300}
                            value={Math.round(slide.zoom * 100)}
                            onChange={(e) => patchSlide({ zoom: +e.target.value / 100 })}
                          />
                          <span className="range-val">{Math.round(slide.zoom * 100)}%</span>
                        </div>
                        <button
                          className="chip"
                          style={{ marginTop: 10 }}
                          onClick={() => patchSlide({ zoom: 1, focus: { x: 50, y: 50 } })}
                        >
                          Resetuj kadar
                        </button>
                        <p className="hint" style={{ marginTop: 12 }}>
                          <I.Info /> Prevuci sliku po platnu da je pomeriš (kadriraš). Zumom je uvećaj pa je nameštaj.
                        </p>
                      </div>
                      <div className="divide" />
                      <div className="field">
                        <label>Zatamnjenje slike</label>
                        <div className="range-row">
                          <input
                            type="range"
                            className="range"
                            min={0}
                            max={80}
                            value={slide.scrim}
                            onChange={(e) => patchSlide({ scrim: +e.target.value })}
                          />
                          <span className="range-val">{slide.scrim}%</span>
                        </div>
                        <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 8, lineHeight: 1.5 }}>
                          Tamniji preliv pomaže da tekst bude čitljiv preko slike.
                        </p>
                      </div>
                      <div className="divide" />
                      <div className="field">
                        <label>Bezbedna zona</label>
                        <button className="btn btn-outline" style={{ width: "100%", marginTop: 6 }} onClick={() => { setSelId(null); setSafeZone(true); setPropTab("safe"); }}>
                          <I.Frame style={{ width: 15, height: 15 }} /> Otvori margine (Safe zone)
                        </button>
                      </div>
                      <div className="divide" />
                      <div className="field">
                        <label>Instagram okvir</label>
                        <div className="toggle-row">
                          <b style={{ fontWeight: 500, fontSize: 13.5 }}>Prikaži ime naloga / trake</b>
                          <button
                            className={`switch${project.chrome ? " on" : ""}`}
                            onClick={() => setProject({ ...project, chrome: !project.chrome })}
                          >
                            <i />
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* ---- AI ---- */}
                  {propTab === "ai" && (
                    <>
                      <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14, lineHeight: 1.5 }}>
                        Opiši ideju objave pa neka AI predloži tekst, caption i raspored.
                      </p>
                      <div className="field">
                        <label>Ideja / tema</label>
                        <textarea
                          className="txt-in"
                          rows={3}
                          placeholder="npr. vikend popust 20% na sitne kolače za slavu"
                          value={aiIdea}
                          onChange={(e) => setAiIdea(e.target.value)}
                        />
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button className="btn btn-primary" style={{ flex: 1 }} disabled={!!aiBusy} onClick={doSuggest}>
                          <I.Sparkle /> {aiBusy === "suggest" ? "Radim…" : "Predloži tekst"}
                        </button>
                        <button className="btn btn-ghost" style={{ flex: 1 }} disabled={!!aiBusy} onClick={doCaption}>
                          {aiBusy === "caption" ? "Radim…" : "Caption + #"}
                        </button>
                      </div>

                      {aiMsg && (
                        <p className="hint" style={{ marginTop: 14 }}>
                          <I.Info /> {aiMsg}
                        </p>
                      )}

                      {aiSuggest && (
                        <div className="ai-card">
                          <div className="ai-card-h">Predlog teksta</div>
                          {aiSuggest.title && (
                            <p>
                              <b>Naslov:</b> {aiSuggest.title}
                            </p>
                          )}
                          {aiSuggest.subtitle && (
                            <p>
                              <b>Podnaslov:</b> {aiSuggest.subtitle}
                            </p>
                          )}
                          {aiSuggest.cta && (
                            <p>
                              <b>CTA:</b> {aiSuggest.cta}
                            </p>
                          )}
                          <button className="btn btn-gold" style={{ width: "100%", marginTop: 10 }} onClick={insertSuggested}>
                            <I.Plus /> Ubaci na platno
                          </button>
                        </div>
                      )}

                      {aiCaption && (
                        <div className="ai-card">
                          <div className="ai-card-h">Caption</div>
                          <p style={{ whiteSpace: "pre-wrap" }}>{aiCaption.caption}</p>
                          {!!aiCaption.hashtags?.length && (
                            <p style={{ color: "var(--plum-300)", marginTop: 6 }}>{aiCaption.hashtags.join(" ")}</p>
                          )}
                          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                            <button className="chip" onClick={() => copyText(aiCaption.caption || "")}>
                              <I.Copy style={{ width: 12, height: 12, marginRight: 5 }} /> Kopiraj caption
                            </button>
                            {!!aiCaption.hashtags?.length && (
                              <button className="chip" onClick={() => copyText((aiCaption.hashtags || []).join(" "))}>
                                <I.Copy style={{ width: 12, height: 12, marginRight: 5 }} /> Kopiraj #
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="divide" />
                      <div className="field">
                        <label>Poboljšaj izabrani tekst</label>
                        {selText ? (
                          <>
                            <select
                              className="mini-select"
                              style={{ width: "100%", height: 42, marginBottom: 10 }}
                              value={aiTone}
                              onChange={(e) => setAiTone(e.target.value)}
                            >
                              <option>Toplo i primamljivo</option>
                              <option>Kraće i udarno</option>
                              <option>Duže i opisno</option>
                              <option>Zvaničnije</option>
                              <option>Zaigrano, sa emojijima</option>
                              <option>Ispravi gramatiku</option>
                            </select>
                            <button className="btn btn-ghost" style={{ width: "100%" }} disabled={!!aiBusy} onClick={doImprove}>
                              <I.Sparkle /> {aiBusy === "improve" ? "Radim…" : `Poboljšaj: „${selText.content.slice(0, 18)}…"`}
                            </button>
                          </>
                        ) : (
                          <p style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>
                            Izaberi tekst (u tabu Tekst ili klikom na platnu) pa ga AI poboljšava.
                          </p>
                        )}
                      </div>

                      <div className="divide" />
                      <div className="field">
                        <label>Raspored (AI)</label>
                        <button className="btn btn-ghost" style={{ width: "100%" }} disabled={!!aiBusy || slide.texts.length === 0} onClick={doLayout}>
                          <I.Sparkle /> {aiBusy === "layout" ? "Radim…" : "Rasporedi tekst po platnu"}
                        </button>
                        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8, lineHeight: 1.5 }}>
                          AI namesti pozicije i veličine slojeva unutar bezbedne zone.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </aside>
            </div>

            {/* Vođeni tok — donja navigacija (Nazad / Dalje) */}
            {wizard && (
              <div className="wiz-foot">
                <button className="btn btn-ghost" onClick={() => (wizStep > 0 ? setWizStep(wizStep - 1) : setView("studio"))}>
                  <I.Back style={{ width: 15, height: 15 }} /> {wizStep > 0 ? "Nazad" : "Izađi"}
                </button>
                {wizStep < wizSteps.length - 1 ? (
                  <button className="btn btn-primary" onClick={() => setWizStep(wizStep + 1)}>
                    Dalje <I.Arrow />
                  </button>
                ) : (
                  <button className="btn btn-primary" onClick={runExport} disabled={!!exportUI}>
                    <I.Export style={{ width: 16, height: 16 }} /> {exportUI ? "Spremam…" : "Sačuvaj u Photos"}
                  </button>
                )}
              </div>
            )}

            {/* MOBILE toolbar */}
            <nav className="mtoolbar">
              <button
                onClick={() => {
                  setPropTab("foto");
                  setSheet("props");
                }}
              >
                <I.ImgIcon /> Foto
              </button>
              <button
                onClick={() => {
                  setPropTab("text");
                  setSheet("props");
                }}
              >
                <I.TextIcon /> Tekst
              </button>
              <button className="mt-primary" onClick={runExport} disabled={!!exportUI}>
                <span className="ic">
                  <I.Export />
                </span>
                {exportUI ? "Izvozim…" : "Izvezi"}
              </button>
              <button
                onClick={() => {
                  setPropTab("red");
                  setSheet("props");
                }}
              >
                <I.Layers /> Red
              </button>
              <button
                onClick={() => {
                  setPropTab("ai");
                  setSheet("props");
                }}
              >
                <I.Sparkle /> AI
              </button>
            </nav>
          </div>
        </section>
      )}
        </main>
      </div>

      {/* ===== MOBILE BOTTOM TABS (sakriveno u vođenom toku) ===== */}
      {!wizard && (
      <nav className="btabs" style={{ gridTemplateColumns: `repeat(${NAV.length}, 1fr)` }}>
        {NAV.map((n) => {
          const Ico = n.icon;
          const active = view === n.key || (n.key === "platno" && view === "editor");
          return (
            <button key={n.key} className={active ? "on" : ""} onClick={() => onNav(n.key)}>
              <span className="btab-ind" />
              <Ico />
              {n.short}
            </button>
          );
        })}
      </nav>
      )}

      {/* ===== NEW PROJECT MODAL ===== */}
      <div className={`overlay${newOpen ? " on" : ""}`}>
        <div className="modal">
          <h2 className="serif">Nova objava</h2>
          <p className="m-sub">Izaberi tip objave — pa na prazno platno dodaješ slike i tekst.</p>
          <div className="fmt-list">
            {(
              [
                ["post", "Objava", "Jedna slika ili video u feed-u."],
                ["carousel", "Carousel", "Više slika/videa koji se prevlače (do 10)."],
                ["story", "Story", "Vertikalno 9:16, nestaje za 24h. IG + TikTok."],
                ["reels", "Reels", "Kratak vertikalni video — najveći domet."],
              ] as [Format, string, string][]
            ).map(([f, title, desc]) => {
              const Ico = FMT_ICON[f];
              return (
                <button key={f} className="fmt-opt" onClick={() => createProject(f)}>
                  <span className="fmt-ico">
                    <Ico />
                  </span>
                  <span>
                    <b>{title}</b>
                    <span>{desc}</span>
                  </span>
                  <span className="fmt-go" aria-hidden>
                    <I.Arrow />
                  </span>
                </button>
              );
            })}
          </div>
          <div className="modal-foot">
            <button className="btn btn-ghost" onClick={() => setNewOpen(false)}>
              Otkaži
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      <div className={`toast${toast ? " on" : ""}`}>
        <I.Check /> <span>{toast}</span>
      </div>

      {/* Progress preklop tokom izvoza */}
      {exportUI && (
        <div
          className="export-overlay"
          onClick={exportUI.files || exportUI.error ? () => setExportUI(null) : undefined}
        >
          <div className={`export-card${exportUI.error ? " err" : ""}`} onClick={(e) => e.stopPropagation()}>
            <div className="export-spin" aria-hidden>
              {exportUI.pct >= 100 ? (exportUI.error ? "!" : "✓") : <I.Sparkle />}
            </div>
            <b>{exportUI.label}</b>
            {!exportUI.files && (
              <div className="export-bar">
                <span style={{ width: `${Math.max(6, Math.min(100, exportUI.pct))}%` }} />
              </div>
            )}
            {exportUI.error ? (
              <button
                className="btn btn-outline"
                style={{ marginTop: 14, height: 40 }}
                onClick={() => {
                  setExportUI(null);
                  setView("log");
                }}
              >
                <I.Journal style={{ width: 16, height: 16 }} /> Vidi dnevnik
              </button>
            ) : exportUI.files && exportUI.files.length > 0 ? (
              <>
                <p className="export-hint" style={{ marginTop: 2, marginBottom: 12 }}>
                  {exportUI.files.length > 1
                    ? "Tapni da sačuvaš sve u Photos (galeriju)."
                    : "Tapni da sačuvaš u Photos (galeriju)."}
                </p>
                <button className="btn btn-primary" style={{ width: "100%", height: 46 }} onClick={shareExport}>
                  <I.Export style={{ width: 17, height: 17 }} /> Sačuvaj u Photos
                </button>
                <button
                  className="btn btn-text"
                  style={{ marginTop: 8 }}
                  onClick={async () => {
                    await downloadOutputs(exportUI.files!, exportUI.base || "objava");
                    setExportUI(null);
                  }}
                >
                  ili preuzmi na uređaj
                </button>
              </>
            ) : (
              <p className="export-hint">Fajl se preuzima na uređaj.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
