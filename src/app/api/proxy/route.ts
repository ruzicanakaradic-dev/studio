import { NextRequest } from "next/server";

/**
 * Same-origin proxy za medije (slike/video) iz Supabase Storage-a.
 * Koristi se pri izvozu: server dovuče fajl (bez CORS ograničenja), a klijent ga
 * dobija sa istog porekla — tako slika/video sigurno uđe u izvezeni PNG/MP4.
 * Ograničeno na Supabase host iz env-a (bez SSRF-a).
 */
export const runtime = "nodejs";

function allowedHost(): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  try {
    return new URL(base).host;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("url");
  if (!target) return new Response("missing url", { status: 400 });

  let host: string;
  try {
    const u = new URL(target);
    if (u.protocol !== "https:" && u.protocol !== "http:") return new Response("bad protocol", { status: 400 });
    host = u.host;
  } catch {
    return new Response("bad url", { status: 400 });
  }

  const allow = allowedHost();
  if (!allow || host !== allow) return new Response("forbidden host", { status: 403 });

  try {
    const upstream = await fetch(target, { cache: "no-store" });
    if (!upstream.ok) return new Response("upstream error", { status: 502 });
    const buf = await upstream.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        "content-type": upstream.headers.get("content-type") || "application/octet-stream",
        "cache-control": "no-store",
      },
    });
  } catch {
    return new Response("fetch failed", { status: 502 });
  }
}
