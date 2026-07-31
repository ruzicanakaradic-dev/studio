import { NextRequest, NextResponse } from "next/server";
import { getValidToken, publishToInstagram, type PublishFormat, type PublishItem } from "@/lib/instagram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // objava videa/reels-a može da potraje

/** Objavi post na Instagram. Token se čita serverski. */
export async function POST(req: NextRequest) {
  let body: { format?: PublishFormat; items?: PublishItem[]; caption?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtev." }, { status: 400 });
  }

  const conn = await getValidToken();
  if (!conn) return NextResponse.json({ error: "Instagram nalog nije povezan." }, { status: 400 });

  const items = (body.items ?? []).filter((it) => it?.imageUrl || it?.videoUrl);
  if (items.length === 0) return NextResponse.json({ error: "Nema medija za objavu." }, { status: 400 });

  try {
    const r = await publishToInstagram({
      igId: conn.igUserId,
      token: conn.token,
      format: body.format ?? "post",
      items,
      caption: body.caption ?? "",
    });
    return NextResponse.json({ ok: true, mediaId: r.mediaId, permalink: r.permalink });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Objava nije uspela.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
