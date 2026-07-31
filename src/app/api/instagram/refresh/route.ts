import { NextRequest, NextResponse } from "next/server";
import { getConnection, refreshLongLivedToken, saveConnection } from "@/lib/instagram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Osvežava dugotrajni token. Poziva se iz zakazanog zadatka (npr. jednom mesečno)
 * sa ?secret=... koji mora da se poklopi sa IG_REFRESH_SECRET.
 */
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const auth = req.headers.get("authorization");
  const bySecret = process.env.IG_REFRESH_SECRET && secret === process.env.IG_REFRESH_SECRET;
  // Vercel Cron šalje: Authorization: Bearer $CRON_SECRET
  const byCron = process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
  if (!bySecret && !byCron) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const conn = await getConnection();
  if (!conn?.access_token || !conn.ig_user_id) {
    return NextResponse.json({ ok: false, reason: "not_connected" });
  }
  try {
    const r = await refreshLongLivedToken(conn.access_token);
    await saveConnection({
      igUserId: conn.ig_user_id,
      username: conn.username ?? "",
      accessToken: r.accessToken,
      expiresIn: r.expiresIn,
    });
    return NextResponse.json({ ok: true, expiresIn: r.expiresIn });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "refresh_failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
