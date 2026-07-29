"use client";

import { FORMAT_META, fontCss } from "@/lib/types";
import type { Project, Slide } from "@/lib/types";
import { mediaUrl } from "@/lib/samples";
import * as I from "./icons";

/**
 * Čist off-screen prikaz jednog slajda za izvoz — ista slika/tekst/CTA kao u editoru,
 * ali bez editor „chrome"-a (bez selekcije, safe-zone, IG traka i zaobljenih ivica).
 * Renderuje se na tačnoj širini editor platna, pa se snima u višu rezoluciju preko pixelRatio.
 */
export function ExportStage({
  project,
  slide,
  width,
  overlayOnly = false,
}: {
  project: Project;
  slide: Slide;
  width: number;
  overlayOnly?: boolean; // za video slajd: samo scrim+tekst+CTA na providnoj podlozi
}) {
  const fmt = FORMAT_META[project.format];
  const height = Math.round(width * (fmt.h / fmt.w));
  const url = mediaUrl(slide.mediaId);
  return (
    <div
      className="canvas export-board"
      style={{
        width,
        height,
        borderRadius: 0,
        boxShadow: "none",
        overflow: "hidden",
        position: "relative",
        flex: "none",
        background: overlayOnly ? "transparent" : undefined,
      }}
    >
      {!overlayOnly && url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="bg"
          src={url}
          crossOrigin="anonymous"
          alt=""
          style={{
            objectPosition: `${slide.focus.x}% ${slide.focus.y}%`,
            transform: `scale(${slide.zoom})`,
            transformOrigin: `${slide.focus.x}% ${slide.focus.y}%`,
          }}
        />
      )}
      <div className="scrim" style={{ opacity: slide.mediaId ? slide.scrim / 100 : 0 }} />

      {slide.mediaId &&
        slide.texts.map((t) => (
          <div className="ov" key={t.id} style={{ left: `${t.pos.x}%`, top: `${t.pos.y}%`, textAlign: t.align, cursor: "default" }}>
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

      {slide.mediaId && slide.cta && (
        <div className="ov" style={{ left: `${slide.ctaPos.x}%`, top: `${slide.ctaPos.y}%`, cursor: "default" }}>
          <span className={`ov-cta ${slide.ctaStyle}`}>
            {slide.ctaText} <I.Arrow />
          </span>
        </div>
      )}
    </div>
  );
}
