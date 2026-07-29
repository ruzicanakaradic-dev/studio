"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Align, CtaStyle, Format, MediaItem, Project, Slide } from "@/lib/types";
import { FORMAT_META, TEXT_COLORS } from "@/lib/types";
import { newProject, freshSlide, mediaUrl } from "@/lib/samples";
import { fetchProjects, fetchMedia, persistProject, uploadMedia } from "@/lib/store";
import * as I from "./icons";

const FMT_ICON: Record<Format, React.FC<React.SVGProps<SVGSVGElement>>> = {
  post: I.FmtPost,
  story: I.FmtStory,
  reels: I.FmtReels,
  carousel: I.FmtCarousel,
};
const FMT_ORDER: Format[] = ["post", "story", "reels", "carousel"];

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
  const [view, setView] = useState<"dash" | "editor">("dash");
  const [projects, setProjects] = useState<Project[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [filter, setFilter] = useState<"all" | Format>("all");
  const [newOpen, setNewOpen] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [active, setActive] = useState(0);
  const [propTab, setPropTab] = useState<"text" | "cta" | "layer">("text");
  const [sheet, setSheet] = useState<null | "media" | "props">(null);
  const [selOv, setSelOv] = useState<null | "text" | "cta">(null);
  const [toast, setToast] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchProjects().then(setProjects);
    fetchMedia().then(setMedia);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  // ---- current slide helpers ----
  const slide = project?.slides[active] ?? null;
  const fmt = project ? FORMAT_META[project.format] : null;

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

  // ---- navigation ----
  function openEditor(p: Project) {
    setProject(structuredClone(p));
    setActive(0);
    setPropTab("text");
    setSelOv(null);
    setView("editor");
    setSheet(null);
  }
  function createProject(format: Format) {
    setNewOpen(false);
    openEditor(newProject(format));
  }
  async function save(exported = false) {
    if (!project) return;
    const toSave = {
      ...project,
      coverMediaId: project.slides[0]?.mediaId ?? project.coverMediaId,
      updatedAt: new Date().toISOString(),
    };
    const res = await persistProject(toSave);
    if (res.id && res.id !== project.id) {
      setProject((p) => (p ? { ...p, id: res.id! } : p));
    }
    setProjects(await fetchProjects());
    if (exported) showToast(res.demo ? "Izvezeno (demo režim)" : "Izvezeno — spremno za Instagram ✦");
    else showToast(res.demo ? "Sačuvano (demo režim)" : "Sačuvano");
  }

  // ---- drag overlays ----
  function startDrag(key: "text" | "cta", e: React.PointerEvent) {
    e.preventDefault();
    setSelOv(key);
    const canvas = canvasRef.current;
    if (!canvas || !slide) return;
    const rect = canvas.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY };
    const origin = { ...slide.pos[key] };
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
        cur.pos = { ...cur.pos, [key]: { x: nx, y: ny } };
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
    } else {
      showToast("Upload radi kad se poveže Supabase Storage");
    }
    e.target.value = "";
  }
  function pickMedia(id: string) {
    patchSlide({ mediaId: id });
    if (window.innerWidth <= 760) setSheet(null);
  }
  function addSlide() {
    setProject((p) => {
      if (!p || p.slides.length >= 10) return p;
      const slides = [...p.slides, freshSlide(null)];
      setActive(slides.length - 1);
      return { ...p, slides };
    });
  }

  const filtered = filter === "all" ? projects : projects.filter((p) => p.format === filter);

  return (
    <div className="app">
      {/* ===== TOP BAR ===== */}
      <header className="topbar">
        <button className="brand" onClick={() => setView("dash")}>
          <span className="logo-mark" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3c2.2 1.4 3.4 3.2 3.4 5.2 0 1.9-1.5 3.3-3.4 3.3S8.6 10.1 8.6 8.2C8.6 6.2 9.8 4.4 12 3Z"
                fill="#C9A96E"
              />
              <path
                d="M4.5 12.5h15c.6 0 1 .5.9 1.1l-.8 5.1a2 2 0 0 1-2 1.7H6.4a2 2 0 0 1-2-1.7l-.8-5.1c-.1-.6.3-1.1.9-1.1Z"
                fill="#fff"
                opacity=".92"
              />
              <circle cx="8.4" cy="16" r="1.1" fill="#4A3566" />
              <circle cx="12" cy="16.6" r="1.1" fill="#4A3566" />
              <circle cx="15.6" cy="16" r="1.1" fill="#4A3566" />
            </svg>
          </span>
          <span className="brand-txt">
            <b>Ružini domaći kolači</b>
            <span>Studio</span>
          </span>
        </button>
        <div className="topbar-spacer" />

        {view === "dash" ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button className="btn btn-ghost desktop-only" onClick={() => setNewOpen(true)}>
              Predlošci
            </button>
            <button className="btn btn-primary" onClick={() => setNewOpen(true)}>
              <I.Plus /> Novi projekat
            </button>
            <span className="avatar" title="Ružica">
              R
            </span>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button className="icon-btn desktop-only" title="Opozovi">
              <I.Undo />
            </button>
            <button className="icon-btn desktop-only" title="Ponovi">
              <I.Redo />
            </button>
            <button className="btn btn-ghost desktop-only" onClick={() => save(false)}>
              Sačuvaj nacrt
            </button>
            <button className="btn btn-gold" onClick={() => save(true)}>
              <I.Export /> Izvezi
            </button>
          </div>
        )}
      </header>

      {/* ===== DASHBOARD ===== */}
      {view === "dash" && (
        <section className="view">
          <div className="dash">
            <aside className="sidebar">
              <div className="side-label">Studio</div>
              <button className="nav-item on">
                <I.Grid /> Projekti
              </button>
              <button className="nav-item" onClick={() => setNewOpen(true)}>
                <I.Eye /> Predlošci
              </button>
              <button className="nav-item">
                <I.Brand /> Brend
              </button>
              <button className="nav-item">
                <I.ImgIcon /> Mediji
              </button>
              <div className="side-foot">
                <b>Instagram Studio</b>
                <p>Kreiraj post, story, reels i carousel — brzo, iz jednog mesta.</p>
                <button className="btn btn-gold" style={{ width: "100%" }} onClick={() => setNewOpen(true)}>
                  Započni
                </button>
              </div>
            </aside>

            <main className="dash-main">
              <h1 className="hello">
                Zdravo, Ružica <span style={{ fontFamily: "var(--font-inter)" }}>👋</span>
              </h1>
              <p className="sub">Nastavi gde si stala ili napravi novu objavu za Instagram.</p>

              <div className="row-head">
                <h2>Tvoji projekti</h2>
                <div className="seg">
                  {(["all", "post", "story", "reels"] as const).map((f) => (
                    <button
                      key={f}
                      className={filter === f ? "on" : ""}
                      onClick={() => setFilter(f)}
                    >
                      {f === "all" ? "Svi" : FORMAT_META[f].short}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid">
                <button className="card new-card" onClick={() => setNewOpen(true)}>
                  <span className="plus">
                    <I.Plus />
                  </span>
                  <b className="serif">Novi projekat</b>
                  <span>Post · Story · Reels · Carousel</span>
                </button>

                {filtered.map((p) => {
                  const Ico = FMT_ICON[p.format];
                  const url = mediaUrl(p.coverMediaId);
                  return (
                    <button key={p.id} className="card" onClick={() => openEditor(p)}>
                      <div className="card-thumb">
                        <span className="badge">
                          <Ico /> {FORMAT_META[p.format].short}
                        </span>
                        {url && <img src={url} alt="" />}
                      </div>
                      <div className="card-body">
                        <h3>{p.name}</h3>
                        <p>Izmenjeno {relTime(p.updatedAt)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </main>
          </div>
        </section>
      )}

      {/* ===== EDITOR ===== */}
      {view === "editor" && project && slide && fmt && (
        <section className="view">
          <div className="editor">
            <div className="ed-bar">
              <button className="icon-btn" title="Nazad" onClick={() => setView("dash")}>
                <I.Back />
              </button>
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
            </div>

            <div className="ed-body">
              <div
                className={`sheet-backdrop${sheet ? " on" : ""}`}
                onClick={() => setSheet(null)}
              />

              {/* LEFT: media */}
              <aside className={`panel panel-l${sheet === "media" ? " open" : ""}`}>
                <div className="panel-h">
                  Mediji
                  <button className="sheet-close" onClick={() => setSheet(null)}>
                    <I.Close />
                  </button>
                </div>
                <div className="media-tabs">
                  <button
                    className={`chip${mediaType === "image" ? " on" : ""}`}
                    onClick={() => setMediaType("image")}
                  >
                    Slike
                  </button>
                  <button
                    className={`chip${mediaType === "video" ? " on" : ""}`}
                    onClick={() => setMediaType("video")}
                  >
                    Video
                  </button>
                </div>
                <div className="panel-scroll">
                  <div className="media-grid">
                    {media
                      .filter((m) => m.kind === mediaType)
                      .map((m) => (
                        <button
                          key={m.id}
                          className={`media-tile${slide.mediaId === m.id ? " sel" : ""}`}
                          onClick={() => pickMedia(m.id)}
                        >
                          <img src={m.url} alt={m.name} />
                          {m.kind === "video" && (
                            <span className="vtag">
                              <I.Play />
                            </span>
                          )}
                        </button>
                      ))}
                    <button className="upload-tile" onClick={() => fileRef.current?.click()}>
                      <I.Upload />
                      Otpremi svoju
                    </button>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,video/*"
                    hidden
                    onChange={onUpload}
                  />
                  <p className="hint" style={{ marginTop: 14 }}>
                    <I.Info /> Klikni na sliku da je dodaš na platno. Za carousel dodaj više slajdova
                    ispod platna.
                  </p>
                </div>
              </aside>

              {/* CENTER: stage */}
              <div className="stage">
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
                </div>

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
                      setSelOv(null);
                      startBgPan(e);
                    }}
                  >
                    {mediaUrl(slide.mediaId) ? (
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
                    ) : (
                      <div className="empty">
                        <I.ImgIcon />
                        <b>Izaberi sliku</b>
                        <span>Klikni na medij levo da započneš dizajn</span>
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

                    {slide.mediaId && (
                      <>
                        <div
                          className={`ov${selOv === "text" ? " sel" : ""}`}
                          style={{
                            left: `${slide.pos.text.x}%`,
                            top: `${slide.pos.text.y}%`,
                            textAlign: slide.align,
                          }}
                          onPointerDown={(e) => startDrag("text", e)}
                        >
                          {slide.title && (
                            <div
                              className="ov-title"
                              style={{ fontSize: slide.titleSize, color: slide.color }}
                            >
                              {slide.title}
                            </div>
                          )}
                          {slide.sub && (
                            <div
                              className="ov-sub"
                              style={{
                                fontSize: Math.max(13, slide.titleSize * 0.42),
                                color: slide.color,
                              }}
                            >
                              {slide.sub}
                            </div>
                          )}
                        </div>

                        {slide.cta && (
                          <div
                            className={`ov${selOv === "cta" ? " sel" : ""}`}
                            style={{ left: `${slide.pos.cta.x}%`, top: `${slide.pos.cta.y}%` }}
                            onPointerDown={(e) => startDrag("cta", e)}
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

                {fmt.carousel && (
                  <div className="carousel">
                    <span className="carousel-label">
                      Slajd {active + 1}/{project.slides.length}
                    </span>
                    <div style={{ display: "flex", gap: 10 }}>
                      {project.slides.map((sl, i) => {
                        const u = mediaUrl(sl.mediaId);
                        return (
                          <button
                            key={sl.id}
                            className={`slide-thumb${i === active ? " on" : ""}`}
                            onClick={() => setActive(i)}
                          >
                            <span className="n">{i + 1}</span>
                            {u && <img src={u} alt="" />}
                          </button>
                        );
                      })}
                    </div>
                    <button className="add-slide" onClick={addSlide}>
                      <I.Plus />
                    </button>
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
                <div className="tabs">
                  <button className={propTab === "text" ? "on" : ""} onClick={() => setPropTab("text")}>
                    <I.TextIcon /> Tekst
                  </button>
                  <button className={propTab === "cta" ? "on" : ""} onClick={() => setPropTab("cta")}>
                    <I.CtaIcon /> CTA
                  </button>
                  <button className={propTab === "layer" ? "on" : ""} onClick={() => setPropTab("layer")}>
                    <I.Layers /> Sloj
                  </button>
                </div>
                <div className="panel-scroll">
                  {propTab === "text" && (
                    <>
                      <div className="field">
                        <label>Naslov</label>
                        <textarea
                          className="txt-in"
                          rows={2}
                          value={slide.title}
                          onChange={(e) => patchSlide({ title: e.target.value })}
                        />
                      </div>
                      <div className="field">
                        <label>Podnaslov</label>
                        <textarea
                          className="txt-in"
                          rows={2}
                          value={slide.sub}
                          onChange={(e) => patchSlide({ sub: e.target.value })}
                        />
                      </div>
                      <div className="divide" />
                      <div className="field">
                        <label>Veličina naslova</label>
                        <div className="range-row">
                          <input
                            type="range"
                            className="range"
                            min={20}
                            max={72}
                            value={slide.titleSize}
                            onChange={(e) => patchSlide({ titleSize: +e.target.value })}
                          />
                          <span className="range-val">{slide.titleSize} px</span>
                        </div>
                      </div>
                      <div className="field">
                        <label>Poravnanje</label>
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
                              className={slide.align === a ? "on" : ""}
                              onClick={() => patchSlide({ align: a })}
                            >
                              <Ico />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="field">
                        <label>Boja teksta</label>
                        <div className="swatches">
                          {TEXT_COLORS.map((c) => (
                            <button
                              key={c}
                              className={`sw${slide.color === c ? " on" : ""}`}
                              style={{ background: c }}
                              onClick={() => patchSlide({ color: c })}
                            />
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {propTab === "cta" && (
                    <>
                      <div className="toggle-row">
                        <b>Prikaži CTA dugme</b>
                        <button
                          className={`switch${slide.cta ? " on" : ""}`}
                          onClick={() => patchSlide({ cta: !slide.cta })}
                        >
                          <i />
                        </button>
                      </div>
                      <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 16, lineHeight: 1.5 }}>
                        Poziv na akciju — npr. „Naruči", „Poruči preko DM-a", „Saznaj više".
                      </p>
                      <div className="field">
                        <label>Tekst dugmeta</label>
                        <input
                          className="txt-in"
                          value={slide.ctaText}
                          onChange={(e) => patchSlide({ ctaText: e.target.value })}
                        />
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
                            <button
                              key={cs}
                              className={slide.ctaStyle === cs ? "on" : ""}
                              onClick={() => patchSlide({ ctaStyle: cs })}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {propTab === "layer" && (
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
                          <I.Info /> Prevuci sliku po platnu da je pomeriš (kadriraš). Zumom je
                          uvećaj pa je nameštaj.
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
                      <div className="divide" />
                      <p className="hint">
                        <I.Layers /> Prevuci naslov i dugme direktno po platnu da ih rasporediš.
                      </p>
                    </>
                  )}
                </div>
              </aside>
            </div>

            {/* MOBILE toolbar */}
            <nav className="mtoolbar">
              <button className={sheet === "media" ? "on" : ""} onClick={() => setSheet("media")}>
                <I.ImgIcon /> Mediji
              </button>
              <button
                onClick={() => {
                  setPropTab("text");
                  setSheet("props");
                }}
              >
                <I.TextIcon /> Tekst
              </button>
              <button className="mt-primary" onClick={() => save(true)}>
                <span className="ic">
                  <I.Export />
                </span>
                Izvezi
              </button>
              <button
                onClick={() => {
                  setPropTab("cta");
                  setSheet("props");
                }}
              >
                <I.CtaIcon /> CTA
              </button>
              <button
                onClick={() => {
                  setPropTab("layer");
                  setSheet("props");
                }}
              >
                <I.Layers /> Sloj
              </button>
            </nav>
          </div>
        </section>
      )}

      {/* ===== NEW PROJECT MODAL ===== */}
      <div className={`overlay${newOpen ? " on" : ""}`}>
        <div className="modal">
          <h2 className="serif">Novi projekat</h2>
          <p className="m-sub">Izaberi format za Instagram objavu.</p>
          <div className="fmt-list">
            {(
              [
                ["post", "Objava (Post)", "Uspravno 4:5 · feed"],
                ["story", "Story", "Vertikalno 9:16 · 24h"],
                ["reels", "Reels", "Video 9:16"],
                ["carousel", "Carousel", "Više slajdova 4:5"],
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
    </div>
  );
}
